namespace MotorControl {
    const PCA9685_ADDR = 0x40
    const MODE1 = 0x00
    const PRESCALE = 0xFE

    // 电机通道映射 (M1~M4 正反转通道)
    const MOTOR_CHANNELS = [
        [12, 11], // M1: [正转, 反转]
        [10, 9],  // M2
        [8, 7],   // M3
        [4, 3]    // M4
    ]

    let initialized = false

    // ====== 核心电机控制函数 ======
    /**
     * 控制电机正反转与速度
     * @param motor 电机编号 (1-4)
     * @param speed 速度 (-255~255) 
     *   - 正值: 正转 (如 150)
     *   - 负值: 反转 (如 -100)
     */
    //% blockId=mc_motor_run block="Motor %motor|speed %speed"
    //% speed.min=-255 speed.max=255
    //% motor.min=1 motor.max=4
    export function MotorRun(motor: number, speed: number): void {
        if (!initialized) initPCA9685()
        if (motor < 1 || motor > 4) return

        const [a, b] = MOTOR_CHANNELS[motor - 1]
        const pwm = Math.clamp(-4095, 4095, speed * 16)

        if (pwm >= 0) {
            setPwm(a, 0, pwm)  // 正转通道
            setPwm(b, 0, 0)    // 反转通道关闭
        } else {
            setPwm(a, 0, 0)    // 正转通道关闭
            setPwm(b, 0, -pwm) // 反转通道
        }
    }

    // ====== PCA9685 初始化 ======
    function initPCA9685(): void {
        i2cwrite(PCA9685_ADDR, MODE1, 0x00)
        setFreq(50)
        for (let ch = 0; ch < 16; ch++) {
            setPwm(ch, 0, 0)
        }
        initialized = true
    }

    function setFreq(freq: number): void {
        const prescale = Math.floor(25000000 / 4096 / freq - 1)
        const oldmode = i2cread(PCA9685_ADDR, MODE1)
        const newmode = (oldmode & 0x7F) | 0x10
        i2cwrite(PCA9685_ADDR, MODE1, newmode)
        i2cwrite(PCA9685_ADDR, PRESCALE, prescale)
        i2cwrite(PCA9685_ADDR, MODE1, oldmode)
        control.waitMicros(5000)
        i2cwrite(PCA9685_ADDR, MODE1, oldmode | 0xA1)
    }

    // ====== PWM 通道设置 (内部使用) ======
    function setPwm(channel: number, on: number, off: number): void {
        if (channel < 0 || channel > 15) return
        const buf = pins.createBuffer(5)
        buf[0] = 0x06 + channel * 4
        buf[1] = on & 0xFF
        buf[2] = (on >> 8) & 0xFF
        buf[3] = off & 0xFF
        buf[4] = (off >> 8) & 0xFF
        pins.i2cWriteBuffer(PCA9685_ADDR, buf)
    }

    // ====== I2C 辅助函数 ======
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