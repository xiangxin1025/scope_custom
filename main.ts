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



enum DIRECTION {
    //% block="CW"
    CW = 0X00,
    //% block="CCW"
    CCW = 0X01
}


namespace Scope {
    // ========== 常量定义（保留） ==========
    const PCA9685_ADDRESS = 0x40
    const MODE1 = 0x00
    const MODE2 = 0x01
    const PWM_CH = 0x06
    const PRESCALE = 0xFE

    // 电机通道映射（枚举M1→索引0，M2→索引1... 一一对应）
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
    //% blockId=ht7k_motor_run 
    //% block="HT7K1311 电机 %motor | 方向 %dir | 速度 %speed"
    //% speed.min=0 speed.max=255
    export function MotorRunFull(motor: MOTOR, dir: DIRECTION, speed: number): void {
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

    // GPIO模式
    /**
     * Set a channel output high or low level (as GPIO)
     * @param channel PCA9685 channel number (0-15); eg: 0, 1, 15
     * @param level false for low level, true for high level; eg: true, false
     */
    //% blockId=Scope_setChannelLevel block="Set channel |%channel| output %level"
    //% channel.min=0 channel.max=15
    //% groups="Motor"
    //% weight=90
    export function setChannelLevel(channel: number, level: boolean): void {
        if (!initialized) {
            initPCA9685()
        }

        if (channel < 0 || channel > 15) {
            return; // 通道号超出范围直接返回
        }

        // 根据PCA9685特性，设置完全开启或完全关闭
        if (level) {
            // 高电平：ON=4096, OFF=0 (特殊值，表示常开)
            setPwm(channel, 4096, 0)
        } else {
            // 低电平：ON=0, OFF=4096 (特殊值，表示常闭)
            setPwm(channel, 0, 4096)
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

    //% blockId=htsetpwm block="setpwm 通道 %channel|on %on|off %off"
    //% channel.min=0 channel.max=15
    //% on.min=0 on.max=4095
    //% off.min=0 off.max=4095
    export function setPwm(channel: number, on: number, off: number): void {
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
}