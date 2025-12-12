// 先定义全局枚举（确保MakeCode积木能识别，也可放在命名空间内，二选一）
enum MOTOR {
    //% block="M1"  // 积木下拉显示"M1"
    M1 = 0x00,
    //% block="M2"  // 积木下拉显示"M2"
    M2 = 0x02,
    //% block="M3"  // 积木下拉显示"M3"
    M3 = 0x04,
    //% block="M4"  // 积木下拉显示"M4"
    M4 = 0x06,
    //% block="ALL" // 积木下拉显示"全部"（也可保留ALL，按你需求）
    ALL = 0x08
}


enum STATE{
    //% block="Speed"
    SPEED,
    //% block="Direction"
    DIR
}

enum DIRECTION {
    //% block="CW"
    CW = 0X00,
    //% block="CCW"
    CCW = 0X01
}

enum SENSOR{
    //% block="AHT20"
    AHT20,
}

enum PARA{
    //% block="Temperature"
    TEMP,
    //% block="Humidity"
    HUM

}

enum RELAY{
    //% block="Actuation"
    CLOSE = 0x01,
    //% block="Release"
    DISCON = 0x00
}


//094
//1d8
//1e3
//% weight=100 color=#5AAD5A icon="" block="Board"
namespace Board {
    let irstate:number;
    let state:number;
    // ========== 常量定义（保留） ==========
    const PCA9685_ADDRESS = 0x40
    const MODE1 = 0x00
    const MODE2 = 0x01
    const PWM_CH = 0x06
    const PRESCALE = 0xFE

    // 电机通道映射 （枚举M1→索引0，M2→索引1... 一一对应）
    const MOTOR_CHANNELS = [
        [12, 11], // M1: [正转通道, 反转通道]
        [10, 9],  // M2
        [8, 7],   // M3
        [4, 3]    // M4
    ]

    // 初始化状态
    let initialized = false

    // ========== 核心：枚举值转电机索引（关键适配） ==========
    function getMotorIndex(motor: MOTOR): number[] {
        // 枚举值 → 电机索引（0=M1,1=M2,2=M3,3=M4）
        switch (motor) {
            case MOTOR.M1: return [0];    // M1对应索引0
            case MOTOR.M2: return [1];    // M2对应索引1
            case MOTOR.M3: return [2];    // M3对应索引2
            case MOTOR.M4: return [3];    // M4对应索引3
            case MOTOR.ALL: return [0, 1, 2, 3]; // ALL对应所有索引
            default: return [];
        }
    }



    // ========== 最终版电机控制函数（保留电机名称枚举下拉） ==========
    /**
     * 控制电机正反转和速度
     * @param motor 选择电机（M1/M2/M3/M4/全部）
     */
    //% weight=101
    //% blockId=ht7k_motor_run 
    //% block="HT7K1311 motor %motor | dir %dir | speed %speed"
    //% speed.min=0 speed.max=255
    export function MotorRun(motor: MOTOR, dir: DIRECTION, speed: number): void {
        if (!initialized) initPCA9685()

        // 获取枚举对应的电机索引
        const motorIndexes = getMotorIndex(motor)
        if (motorIndexes.length === 0) return

        // speed 映射到 PWM（0~255 → 0~4095）
        const pwm = Math.clamp(0, 4095, speed * 16)

        for (const idx of motorIndexes) {
            const [forwardCh, reverseCh] = MOTOR_CHANNELS[idx]

            if (dir == DIRECTION.CW) {
                // 正转：forward = pwm，reverse = 0
                setPwm(forwardCh, 0, pwm)
                setPwm(reverseCh, 0, 0)
            } else {
                // 反转：forward = 0，reverse = pwm
                setPwm(forwardCh, 0, 0)
                setPwm(reverseCh, 0, pwm)
            }
            basic.pause(10)
        }
    }

    /**
     * 停止指定电机（或全部电机）
     * @param index 电机（M1/M2/M3/M4/ALL）
     */
    //% weight=99
    //% blockId=pinpong_motorStop 
    //% block="HT7K1311 motor %index stop"
    export function motorStop(index: MOTOR): void {
        if (!initialized) initPCA9685()

        const motorIndexes = getMotorIndex(index)
        if (motorIndexes.length === 0) return

        for (const idx of motorIndexes) {
            const [forwardCh, reverseCh] = MOTOR_CHANNELS[idx]
            setPwm(forwardCh, 0, 0)
            setPwm(reverseCh, 0, 0)
        }
    }
    // GPIO模式
    /**
     * Set a channel output high or low level (as GPIO)
     * @param channel PCA9685 channel number (0-15); eg: 0, 1, 15
     * @param level Output level: 1 for high, 0 for low; eg: 1, 0
     */
    // % blockId=Scope_setChannelLevel block="Set channel |%channel| output %level"
    // % channel.min=0 channel.max=15
    // % groups="Motor"
    // % weight=99
    function setChannelLevel(channel: number, level: number): void {
        if (!initialized) initPCA9685()
        if (channel < 0 || channel > 15) return

        // 适配setPwm的0~4095限制：用100%/0%占空比实现高低电平
        if (level) {
            // 高电平：ON=0，OFF=4095（低电平占空比100%）
            setPwm(channel, 0, 4096)
        } else {
            // 低电平：ON=4095，OFF=0（低电平占空比0%）
            setPwm(channel, 4096, 0)
        }
    }

    // ========== PCA9685底层函数（仅修正注解，保留功能） ==========
    function initPCA9685(): void {
        i2cwrite(PCA9685_ADDRESS, MODE1, 0x00)
        setFreq(50)
        for (let ch = 0; ch < 16; ch++) {
            setPwm(ch, 0, 0) // 初始化所有通道为0
        }
        initialized = true
    }

    export function setFreq(freq: number): void {
        const prescaleval = 25000000 / 4096 / freq - 1
        const prescale = Math.floor(prescaleval + 0.5)
        const oldmode = i2cread(PCA9685_ADDRESS, MODE1)
        const newmode = (oldmode & 0x7F) | 0x10
        i2cwrite(PCA9685_ADDRESS, MODE1, newmode)
        i2cwrite(PCA9685_ADDRESS, PRESCALE, prescale)
        i2cwrite(PCA9685_ADDRESS, MODE1, oldmode)
        control.waitMicros(5000)
        i2cwrite(PCA9685_ADDRESS, MODE1, oldmode | 0xA1)
    }
    // /**
    //  * Set the PWM output of one channel
    //  * @param channel PCA9685 channel number (0-15); eg: 0, 1, 15
    //  * @param on PWM on time in microseconds (0 to 4096); 
    //  * @param off PWM off time in microseconds (0 to 4096); 
    //  */
    // //% weight=100
    // //% blockId=htsetpwm block="setpwm channel %channel|on %on|off %off"
    // //% channel.min=0 channel.max=15
    // //% on.min=0 on.max=4095
    // //% off.min=0 off.max=4095
    function setPwm(channel: number, on: number, off: number): void {
        if (channel < 0 || channel > 15) return
        on = Math.clamp(0, 4095, on)
        off = Math.clamp(0, 4095, off)
        const buf = pins.createBuffer(5)
        buf[0] = PWM_CH + 4 * channel
        buf[1] = on & 0xFF
        buf[2] = (on >> 8) & 0xFF
        buf[3] = off & 0xFF
        buf[4] = (off >> 8) & 0xFF
        pins.i2cWriteBuffer(PCA9685_ADDRESS, buf)
    }


    
    
    // I2C辅助函数
    function i2cwrite(addr: number, reg: number, value: number): void {
        const buf = pins.createBuffer(2)
        buf[0] = reg
        buf[1] = value
        pins.i2cWriteBuffer(addr, buf)
    }
    
    function i2cread(addr: number, reg: number): number {
        pins.i2cWriteNumber(addr, reg, NumberFormat.UInt8BE)
        return pins.i2cReadNumber(addr, NumberFormat.UInt8BE)
    }
    
    /**
     * 控制交通灯
     */
    //% weight=97
    //% state.min=0 state.max=1
    //% state1.min=0 state1.max=1
    //% state2.min=0 state2.max=1
    //% blockId=pinpong_LED block="set traffic lights Red LED %state Yellow LED %state1 Green LED %state2"
    export function LED(state: number, state1: number, state2: number) {
        setChannelLevel(5, state);//红灯
        setChannelLevel(0, state1);//黄灯
        setChannelLevel(1, state2);//绿灯

    }

    /**
     * 获取旋转编码器数据
     */
    //% weight=96
    //% blockId=pinpong_readAngle block="obtain angle sensor data"
    export function readAngle():number{
        let value = pins.analogReadPin(AnalogReadWritePin.P2)
        return value
    }

    /**
     * 获取火焰传感器数据
     */
    //% weight=95
    //% blockId=pinpong_readFlame block="get fire sensor number"
    export function readFlre(): number {
        let value = pins.analogReadPin(AnalogReadWritePin.P1)
        return value
    }

    
    /**
     * 获取超声波数据
    */
   //%weight=93
   //% blockId=ultrasonic_sensor block="get ultrasonic sensor (cm)"
    export function Ultrasonic(maxCmDistance = 500): number {
        let d
        pins.digitalWritePin(DigitalPin.P16, 1);
        basic.pause(1)
        pins.digitalWritePin(DigitalPin.P16, 0);
        if (pins.digitalReadPin(DigitalPin.P12) == 0) {
            pins.digitalWritePin(DigitalPin.P16, 0);
            //sleep_us(2);
            pins.digitalWritePin(DigitalPin.P16, 1);
            // sleep_us(10);
            pins.digitalWritePin(DigitalPin.P16, 0);
            d = pins.pulseIn(DigitalPin.P12, PulseValue.High, maxCmDistance * 58)//readPulseIn(1);
        } else {
            pins.digitalWritePin(DigitalPin.P16, 1);
            pins.digitalWritePin(DigitalPin.P16, 0);
            d = pins.pulseIn(DigitalPin.P12, PulseValue.Low, maxCmDistance * 58);//readPulseIn(0);
        }
        let x = d / 59;
        if (x <= 0 || x > 500) {
            return 0;
        }
        return Math.round(x) ;
    }
    
    /**
     * 控制继电器
     */
    //% weight=92
    //%blockId=pinpong_setRelay block="relay %state"
    export function setRelay(state:RELAY){
        switch (state) {
            case RELAY.CLOSE: setChannelLevel( 2 ,  1 ); break;
            case RELAY.DISCON: setChannelLevel( 2 , 0 ); break;
            default: break;
        }
    }

    
    /**
    * Initialize OLED, just put the module in the module at the beginning of the code, no need to reuse
    */
    function initDisplay(): void {
        OLEDcmd(0xAE);  // Set display OFF
        OLEDcmd(0xD5);  // Set Display Clock Divide Ratio / OSC Frequency 0xD4
        OLEDcmd(0x80);  // Display Clock Divide Ratio / OSC Frequency 
        OLEDcmd(0xA8);  // Set Multiplex Ratio
        OLEDcmd(0x3F);  // Multiplex Ratio for 128x64 (64-1)
        OLEDcmd(0xD3);  // Set Display Offset
        OLEDcmd(0x00);  // Display Offset
        OLEDcmd(0x40);  // Set Display Start Line
        OLEDcmd(0x8D);  // Set Charge Pump
        OLEDcmd(0x14);  // Charge Pump (0x10 External, 0x14 Internal DC/DC)
        OLEDcmd(0xA1);  // Set Segment Re-Map
        OLEDcmd(0xC8);  // Set Com Output Scan Direction
        OLEDcmd(0xDA);  // Set COM Hardware Configuration
        OLEDcmd(0x12);  // COM Hardware Configuration
        OLEDcmd(0x81);  // Set Contrast
        OLEDcmd(0xCF);  // Contrast
        OLEDcmd(0xD9);  // Set Pre-Charge Period
        OLEDcmd(0xF1);  // Set Pre-Charge Period (0x22 External, 0xF1 Internal)
        OLEDcmd(0xDB);  // Set VCOMH Deselect Level
        OLEDcmd(0x40);  // VCOMH Deselect Level
        OLEDcmd(0xA4);  // Set all pixels OFF
        OLEDcmd(0xA6);  // Set display not inverted
        OLEDcmd(0xAF);  // Set display On
        OLEDclear();
    }
    

    
    function OLEDsetText(row: number, column: number) {
        let r = row;
        let c = column;
        if (row < 0) { r = 0 }
        if (column < 0) { c = 0 }
        if (row > 7) { r = 7 }
        if (column > 15) { c = 15 }

        OLEDcmd(0xB0 + r);            //set page address
        OLEDcmd(0x00 + (8 * c & 0x0F));  //set column lower address
        OLEDcmd(0x10 + ((8 * c >> 4) & 0x0F));   //set column higher address
    }

    function OLEDputChar(c: string) {
        let c1 = c.charCodeAt(0);
        OLEDwriteCustomChar(basicFont[c1 - 32]);
    }
    /**
     * @param line line num (8 pixels per line), eg: 0
     * @param text value , eg: DFRobot
     * OLED  display string
     */
    //% weight=90
    //% text.defl="Hello World"
    //% line.min=0 line.max=7
    //% column.min=0 column.max=15
    //% block="OLED show text %text on line %line column %column"
    export function OLEDshowUserText(text: string,line: number,column:number): void {
        OLEDsetText(line, column);
        if(text.length>16){
            let newtext = text.substr(0,16);
            for (let c of newtext)
                OLEDputChar(c);
        }else{
            if(text.length>(16-column)){
                let newtext = text.substr(0,(16-column));
                for (let c of newtext)
                    OLEDputChar(c);
            }else{
                for (let c of text)
                    OLEDputChar(c);
            }
            
        }
        
        
    }
	/**
     * @param line line num (8 pixels per line), eg: 0
     * @param n value , eg: 2019
     * OLED  shows the number
     */
    //% weight=89
    //% line.min=0 line.max=7
    //% column.min=0 column.max=15
    //% block="OLED show number %n on line %line column %column"

    export function OLEDshowUserNumber(n: number,line: number, column:number): void {
        Board.OLEDshowUserText("" + n,line, column);
    }

    /**
     * OLED clear
     */
    //% weight=88
    //% block="clear OLED"
    export function OLEDclear() {
        for (let j = 0; j < 8; j++) {
            OLEDsetText(j, 0);
                for (let i=0; i < 16; i++)  //clear all columns
                {
                    OLEDputChar(' ');
                }
        }
        OLEDsetText(0, 0);
    }
    //% weight=87
    //% block="clear OLED line %line column %column1 to %column2"
    //% line.min=0 line.max=7
    //% column1.min=0 column1.max=15
    //% column2.min=0 column2.max=15
    export function clear(line:number,column1:number,column2:number){
        OLEDsetText(line, column1);
        for (let i=0; i < ((column2-column1)+1); i++) {
            OLEDputChar(' ');
        }
    }

    function OLEDwriteCustomChar(c: string) {
        for (let i = 0; i < 8; i++) {
            OLEDwriteData(c.charCodeAt(i));
        }
    }


    function OLEDcmd(c: number) {
        pins.i2cWriteNumber(0x3C, c, NumberFormat.UInt16BE);
    }


    function OLEDwriteData(n: number) {
        let b = n;
        if (n < 0) { n = 0 }
        if (n > 255) { n = 255 }

        pins.i2cWriteNumber(0x3C, 0x4000 + b, NumberFormat.UInt16BE);
    }

    const DISPLAY_OFF = 0xAE;
    const DISPLAY_ON = 0xAF;
    const basicFont: string[] = [
        "\x00\x00\x00\x00\x00\x00\x00\x00", // " "
        "\x00\x00\x5F\x00\x00\x00\x00\x00", // "!"
        "\x00\x00\x07\x00\x07\x00\x00\x00", // """
        "\x00\x14\x7F\x14\x7F\x14\x00\x00", // "#"
        "\x00\x24\x2A\x7F\x2A\x12\x00\x00", // "$"
        "\x00\x23\x13\x08\x64\x62\x00\x00", // "%"
        "\x00\x36\x49\x55\x22\x50\x00\x00", // "&"
        "\x00\x00\x05\x03\x00\x00\x00\x00", // "'"
        "\x00\x1C\x22\x41\x00\x00\x00\x00", // "("
        "\x00\x41\x22\x1C\x00\x00\x00\x00", // ")"
        "\x00\x08\x2A\x1C\x2A\x08\x00\x00", // "*"
        "\x00\x08\x08\x3E\x08\x08\x00\x00", // "+"
        "\x00\xA0\x60\x00\x00\x00\x00\x00", // ","
        "\x00\x08\x08\x08\x08\x08\x00\x00", // "-"
        "\x00\x60\x60\x00\x00\x00\x00\x00", // "."
        "\x00\x20\x10\x08\x04\x02\x00\x00", // "/"
        "\x00\x3E\x51\x49\x45\x3E\x00\x00", // "0"
        "\x00\x00\x42\x7F\x40\x00\x00\x00", // "1"
        "\x00\x62\x51\x49\x49\x46\x00\x00", // "2"
        "\x00\x22\x41\x49\x49\x36\x00\x00", // "3"
        "\x00\x18\x14\x12\x7F\x10\x00\x00", // "4"
        "\x00\x27\x45\x45\x45\x39\x00\x00", // "5"
        "\x00\x3C\x4A\x49\x49\x30\x00\x00", // "6"
        "\x00\x01\x71\x09\x05\x03\x00\x00", // "7"
        "\x00\x36\x49\x49\x49\x36\x00\x00", // "8"
        "\x00\x06\x49\x49\x29\x1E\x00\x00", // "9"
        "\x00\x00\x36\x36\x00\x00\x00\x00", // ":"
        "\x00\x00\xAC\x6C\x00\x00\x00\x00", // ";"
        "\x00\x08\x14\x22\x41\x00\x00\x00", // "<"
        "\x00\x14\x14\x14\x14\x14\x00\x00", // "="
        "\x00\x41\x22\x14\x08\x00\x00\x00", // ">"
        "\x00\x02\x01\x51\x09\x06\x00\x00", // "?"
        "\x00\x32\x49\x79\x41\x3E\x00\x00", // "@"
        "\x00\x7E\x09\x09\x09\x7E\x00\x00", // "A"
        "\x00\x7F\x49\x49\x49\x36\x00\x00", // "B"
        "\x00\x3E\x41\x41\x41\x22\x00\x00", // "C"
        "\x00\x7F\x41\x41\x22\x1C\x00\x00", // "D"
        "\x00\x7F\x49\x49\x49\x41\x00\x00", // "E"
        "\x00\x7F\x09\x09\x09\x01\x00\x00", // "F"
        "\x00\x3E\x41\x41\x51\x72\x00\x00", // "G"
        "\x00\x7F\x08\x08\x08\x7F\x00\x00", // "H"
        "\x00\x41\x7F\x41\x00\x00\x00\x00", // "I"
        "\x00\x20\x40\x41\x3F\x01\x00\x00", // "J"
        "\x00\x7F\x08\x14\x22\x41\x00\x00", // "K"
        "\x00\x7F\x40\x40\x40\x40\x00\x00", // "L"
        "\x00\x7F\x02\x0C\x02\x7F\x00\x00", // "M"
        "\x00\x7F\x04\x08\x10\x7F\x00\x00", // "N"
        "\x00\x3E\x41\x41\x41\x3E\x00\x00", // "O"
        "\x00\x7F\x09\x09\x09\x06\x00\x00", // "P"
        "\x00\x3E\x41\x51\x21\x5E\x00\x00", // "Q"
        "\x00\x7F\x09\x19\x29\x46\x00\x00", // "R"
        "\x00\x26\x49\x49\x49\x32\x00\x00", // "S"
        "\x00\x01\x01\x7F\x01\x01\x00\x00", // "T"
        "\x00\x3F\x40\x40\x40\x3F\x00\x00", // "U"
        "\x00\x1F\x20\x40\x20\x1F\x00\x00", // "V"
        "\x00\x3F\x40\x38\x40\x3F\x00\x00", // "W"
        "\x00\x63\x14\x08\x14\x63\x00\x00", // "X"
        "\x00\x03\x04\x78\x04\x03\x00\x00", // "Y"
        "\x00\x61\x51\x49\x45\x43\x00\x00", // "Z"
        "\x00\x7F\x41\x41\x00\x00\x00\x00", // """
        "\x00\x02\x04\x08\x10\x20\x00\x00", // "\"
        "\x00\x41\x41\x7F\x00\x00\x00\x00", // """
        "\x00\x04\x02\x01\x02\x04\x00\x00", // "^"
        "\x00\x80\x80\x80\x80\x80\x00\x00", // "_"
        "\x00\x01\x02\x04\x00\x00\x00\x00", // "`"
        "\x00\x20\x54\x54\x54\x78\x00\x00", // "a"
        "\x00\x7F\x48\x44\x44\x38\x00\x00", // "b"
        "\x00\x38\x44\x44\x28\x00\x00\x00", // "c"
        "\x00\x38\x44\x44\x48\x7F\x00\x00", // "d"
        "\x00\x38\x54\x54\x54\x18\x00\x00", // "e"
        "\x00\x08\x7E\x09\x02\x00\x00\x00", // "f"
        "\x00\x18\xA4\xA4\xA4\x7C\x00\x00", // "g"
        "\x00\x7F\x08\x04\x04\x78\x00\x00", // "h"
        "\x00\x00\x7D\x00\x00\x00\x00\x00", // "i"
        "\x00\x80\x84\x7D\x00\x00\x00\x00", // "j"
        "\x00\x7F\x10\x28\x44\x00\x00\x00", // "k"
        "\x00\x41\x7F\x40\x00\x00\x00\x00", // "l"
        "\x00\x7C\x04\x18\x04\x78\x00\x00", // "m"
        "\x00\x7C\x08\x04\x7C\x00\x00\x00", // "n"
        "\x00\x38\x44\x44\x38\x00\x00\x00", // "o"
        "\x00\xFC\x24\x24\x18\x00\x00\x00", // "p"
        "\x00\x18\x24\x24\xFC\x00\x00\x00", // "q"
        "\x00\x00\x7C\x08\x04\x00\x00\x00", // "r"
        "\x00\x48\x54\x54\x24\x00\x00\x00", // "s"
        "\x00\x04\x7F\x44\x00\x00\x00\x00", // "t"
        "\x00\x3C\x40\x40\x7C\x00\x00\x00", // "u"
        "\x00\x1C\x20\x40\x20\x1C\x00\x00", // "v"
        "\x00\x3C\x40\x30\x40\x3C\x00\x00", // "w"
        "\x00\x44\x28\x10\x28\x44\x00\x00", // "x"
        "\x00\x1C\xA0\xA0\x7C\x00\x00\x00", // "y"
        "\x00\x44\x64\x54\x4C\x44\x00\x00", // "z"
        "\x00\x08\x36\x41\x00\x00\x00\x00", // "{"
        "\x00\x00\x7F\x00\x00\x00\x00\x00", // "|"
        "\x00\x41\x36\x08\x00\x00\x00\x00", // "}"
        "\x00\x02\x01\x01\x02\x01\x00\x00"  // "~"
    ];
    let _brightness = 255
    let neopixel_buf = pins.createBuffer(16 * 3);
    for (let i = 0; i < 16 * 3; i++) {
        neopixel_buf[i] = 0
    }
   /**
    * 红外
    */
    //% advanced=true shim=maqueenIRV2::irCode
    function irCode(): number {
        return 0;
    }
    
    //% weight=86
    //% blockId=IR_read block="read IR key value"
    export function IR_read(): number {
        pins.setPull(DigitalPin.P13, PinPullMode.PullUp)
        return irCode()&0x00ff;
    }

    //% weight=85
    //% blockId=IR_callbackUser block="on IR received"
    //% draggableParameters
    export function IR_callbackUser(cb: (message: number) => void) {
        pins.setPull(DigitalPin.P13, PinPullMode.PullUp)
        state = 1;
        control.onEvent(11, 22, function() {
            cb(irstate)
        }) 
    }
    
    basic.forever(() => {
        if(state == 1){
            irstate = irCode()&0x00ff;
            if(irstate != -1){
                control.raiseEvent(11, 22)
            }
        }
        
        basic.pause(20);
    })
     /** 
     * Set the three primary color:red, green, and blue
     */
    //% weight=84
    //% r.min=0 r.max=255
    //% g.min=0 g.max=255
    //% b.min=0 b.max=255
    //%  block="red|%r green|%g blue|%b"
    export function rgb(r: number, g: number, b: number): number {
        return (r << 16) + (g << 8) + (b);
    }

    /**
     * RGB LEDs light up from A to B 
     */
    //% weight=83
    //% from.min=0 from.max=1
    //% to.min=0 to.max=1
    //% to.defl=1
    //% from.defl=0
    //%  block="RGB LEDs |%from to|%to"
    export function ledRange(from: number, to: number): number {
        let _from=from;
        let _to=to+1;
        return (_from << 16) + (2 << 8) + (_to);
    }
    /**
     * Set the color of the specified LEDs
     */
    //% weight=82
    //% index.min=0 index.max=1
    //% index.defl=0
    //% rgb.shadow="colorNumberPicker"
    //%  block="RGB LED |%index show color|%rgb"
    export function setIndexColor(index: number, rgb: number) {
        let f = index;
        let t = index;
        let r = (rgb >> 16) * (_brightness / 255);
        let g = ((rgb >> 8) & 0xFF) * (_brightness / 255);
        let b = ((rgb) & 0xFF) * (_brightness / 255);

        if ((index) > 15) {
            if ((((index) >> 8) & 0xFF) == 0x02) {
                f = (index) >> 16;
                t = (index) & 0xff;
            } else {
                f = 0;
                t = -1;
            }
        }
        for (let i = f; i <= t; i++) {
            neopixel_buf[i * 3 + 0] = Math.round(g)
            neopixel_buf[i * 3 + 1] = Math.round(r)
            neopixel_buf[i * 3 + 2] = Math.round(b)
        }
        ws2812b.sendBuffer(neopixel_buf, DigitalPin.P15)

    }
    /**
        * Set the color of all RGB LEDs
        */
    //% weight=81
    //% rgb.shadow="colorNumberPicker"
    //%  block="show color |%rgb"
    export function showColor(rgb: number) {
        let r = (rgb >> 16) * (_brightness / 255);
        let g = ((rgb >> 8) & 0xFF) * (_brightness / 255);
        let b = ((rgb) & 0xFF) * (_brightness / 255);
        for (let i = 0; i < 16 * 3; i++) {
            if ((i % 3) == 0)
                neopixel_buf[i] = Math.round(g)
            if ((i % 3) == 1)
                neopixel_buf[i] = Math.round(r)
            if ((i % 3) == 2)
                neopixel_buf[i] = Math.round(b)
        }
        ws2812b.sendBuffer(neopixel_buf, DigitalPin.P15)
    }
    /**
     * Set the brightness of RGB LED
     */
    //% weight=80
    //% brightness.min=0 brightness.max=255
    //% block="set brightness to |%brightness"
    export function setBrightness(brightness: number) {
        _brightness = brightness;
    }
    /**
     * Turn off all RGB LEDs
     */
    //% weight=79
    //%  block="clear all LEDs"
    export function ledBlank() {
        showColor(0)
    }

    //% weight=78
    //% block="init %sensor temperature and humidity sensor"
    export function tempHumiInit(sensor:SENSOR){
        basic.pause(30);
        if(sensor == SENSOR.AHT20){
            pins.i2cWriteNumber(0x38, 0xBA, NumberFormat.Int8LE);
            let data=pins.i2cReadNumber(0x38, NumberFormat.Int8LE);
            if((data & 0x08) != 1){
            let buf=pins.createBuffer(3)
                buf[0]=0xBE;
                buf[1]=0X08;
                buf[2]=0x00;
                pins.i2cWriteBuffer(0x38, buf)
            }
        }
        
    }
    /**
     * 获取温湿度数据
     */
    //% weight=77
    //% block="read %sensor %state"
    export function readSensor(sensor:SENSOR, state:PARA): number{
        let data;
        if(sensor == SENSOR.AHT20) {
            let buf=pins.createBuffer(3);
            buf[0]=0xAC;
            buf[1]=0X33;
            buf[2]=0x00;
            pins.i2cWriteBuffer(0x38, buf);
            let buf1=pins.i2cReadBuffer(0x38, 7);
            switch(state){
                case PARA.HUM:data=((buf1[1] << 12) + (buf1[2] << 4) + (buf1[3] >> 4)) / 1048576 * 100, 2;break;
                case PARA.TEMP:data=(((buf1[3] & 0x0f) << 16) + (buf1[4] << 8) + (buf1[5])) / 1048576 * 200 - 50
                    , 2;break;
                
                default:break;
            }
        }
        
        return Math.round(data);
    }
    
    
    
    
    /**
     * init I2C
     */
    //% block="init Board"
    //% weight=110
    export function initBoard():void{
        //init();
        basic.pause(30)
        // AHT20Init()
        basic.pause(30)
        initDisplay()
    
    }
}