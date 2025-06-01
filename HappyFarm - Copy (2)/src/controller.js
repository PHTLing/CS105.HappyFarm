import * as THREE from 'three';
import { SoundManager } from './sound.js';

/** CarController class manages the movement and rotation logic of the car.**/
export class CarController {
    constructor({ carGroup, frontWheel_L, frontWheel_R, wheel_L, wheel_R, backWheels }) {
        // Names of carGroup parts
        this.carGroup = carGroup; 
        this.frontWheel_L = frontWheel_L;   
        this.frontWheel_R = frontWheel_R;   
        this.wheel_L = wheel_L;             
        this.wheel_R = wheel_R;             
        this.backWheels = backWheels;       

        // Movement speed parameters for forward/ backward
        this.currentSpeed = 0;
        this.maxSpeed = 0.2; // Giữ nguyên để tính toán mong muốn, nhưng lực thực tế sẽ thay đổi
        this.acceleration = 0.02;
        this.deceleration = 0.005;
        this.brakeDeceleration = 0.01;
        this.boostMultiplier = 1.5;

        // Rotation speed parameters for left/right turn
        this.currentRotationSpeed = 0; 
        this.maxRotationSpeed = 0.02; 
        this.rotationAcceleration = 0.004; 
        this.rotationDeceleration = 0.008; 

        // Steering parameters for front wheels
        this.steeringAngle = 0; 
        this.maxSteeringAngle = Math.PI / 6; //radians: 30
        this.wheelTurnSpeed = 0.05; 
        this.carTurnSensitivity = 0.8; 
        this.wheelbase = 3.0; 
        this.wheelRadius = 0.5; 

        // Audio and lights
        this.headlights = [];   // Mảng chứa các đối tượng đèn pha (THREE.SpotLight hoặc THREE.PointLight)
        this.headlightsOn = false;

        // Lưu trữ trạng thái phím trước đó để phát hiện sự kiện nhấn/nhả
        this.soundManager = null; 
        this.previousKeyState = {};

        // === THÊM CÁC BIẾN MỚI ĐỂ LƯU TRỮ LỰC TÁC ĐỘNG VÀ MÔ-MEN XOẮN ===
        this.engineForce = 0;     // Lực động cơ áp dụng vào xe
        this.steeringTorque = 0;  // Mô-men xoắn để lái xe
    }
    /**
     * Khởi tạo các đối tượng âm thanh. Cần AudioListener và AudioLoader từ Three.js
     * @param {THREE.AudioListener} listener
     * @param {THREE.AudioLoader} audioLoader
     */
    async initAudio(listener, audioLoader) {
        this.soundManager = new SoundManager(listener, audioLoader);
        await this.soundManager.loadSounds(); // Đảm bảo âm thanh được tải xong
        this.initHeadlights();
    }

    /**
     * Thêm các đối tượng đèn pha vào carGroup.
     * Cần tạo các đèn trong Three.js (ví dụ THREE.SpotLight) và thêm vào carGroup.
     */
    initHeadlights() {
        // Ví dụ tạo đèn pha (điểm sáng)
        const headlight1 = new THREE.PointLight(0xffff00, 5, 100);
        headlight1.position.set(1.2, 0.3, 3); // Điều chỉnh vị trí  1, 1, 2.8
        this.carGroup.add(headlight1);
        this.headlights.push(headlight1);

        const headlight2 = new THREE.PointLight(0xffff00, 5, 100);
        headlight2.position.set(-1.2, 0.3, 3); // Điều chỉnh vị trí 1, 1, 2.8
        this.carGroup.add(headlight2);
        this.headlights.push(headlight2);

        // Ban đầu tắt đèn
        this.toggleHeadlights(false);
    }

    //Toggle Headlights
    toggleHeadlights(on) {
        this.headlightsOn = on !== undefined ? on : !this.headlightsOn; // Đảo trạng thái nếu không có tham số
        this.headlights.forEach(light => {
            light.visible = this.headlightsOn;
        });
    }

    // === CẬP NHẬT: THÊM deltaTime VÀ TÍNH TOÁN LỰC/MÔ-MEN XOẮN ===
    _processInput(keyState, deltaTime) {
        const currentKeyState = { ...keyState };

        const isBoosting = keyState['b'];
        const isBraking = keyState[' '];

        // --- Logic Update speed ---
        let targetSpeedMultiplier = 0;

        if (keyState['w'] || keyState['arrowup']) {
            let boost = isBoosting ? this.boostMultiplier : 1;
            if (isBraking) {
                this.currentSpeed -= this.brakeDeceleration / 3;
                if (this.currentSpeed < 0) this.currentSpeed = 0;
            } else {
                if (this.currentSpeed < this.maxSpeed * boost) {
                    this.currentSpeed += this.acceleration * boost;
                }
            }
            targetSpeedMultiplier = this.currentSpeed / (this.maxSpeed * boost);
        }
        else if (keyState['s'] || keyState['arrowdown']) {
            if (isBraking) {
                this.currentSpeed += this.brakeDeceleration / 6;
                if (this.currentSpeed > 0) this.currentSpeed = 0;
            } else {
                if (this.currentSpeed > -this.maxSpeed / 2) {
                    this.currentSpeed -= this.acceleration / 4;
                }
            }
            targetSpeedMultiplier = this.currentSpeed / (this.maxSpeed / 2);
        }
        else {
            if (this.currentSpeed > 0) {
                this.currentSpeed -= this.deceleration;
                if (this.currentSpeed < 0) this.currentSpeed = 0;
            } else if (this.currentSpeed < 0) {
                this.currentSpeed += this.deceleration / 2;
                if (this.currentSpeed > 0) this.currentSpeed = 0;
            }
        }

        // --- TÍNH TOÁN LỰC ĐỘNG CƠ THỰC TẾ ---
        // ✅ SỬA LỖI: Đặt baseEngineForce thành một giá trị hợp lý (ví dụ: 800)
        const baseEngineForce = 800; // TÙY CHỈNH GIÁ TRỊ NÀY
        this.engineForce = targetSpeedMultiplier * baseEngineForce;


        // Xử lý phanh: Nếu nhấn phanh, loại bỏ lực động cơ và tác dụng lực cản lớn
        if (isBraking && Math.abs(this.carGroup.userData.velocity.length()) > 0.05) {
            this.engineForce = 0; // Hủy lực động cơ
            const brakeForceMagnitude = 2000; // Lực phanh, TÙY CHỈNH GIÁ TRỊ NÀY
            const brakeDirection = this.carGroup.userData.velocity.clone().normalize().negate();
            this.carGroup.userData.forces.add(brakeDirection.multiplyScalar(brakeForceMagnitude));
        }

        // --- Logic Update rotation (vẫn giữ để tính steeringAngle và điều khiển bánh xe) ---
        let targetSteeringAngle = 0; 
        if (keyState['a'] || keyState['arrowleft']) { 
            targetSteeringAngle = -this.maxSteeringAngle; 
        } else if (keyState['d'] || keyState['arrowright']) { 
            targetSteeringAngle = this.maxSteeringAngle; 
        } 
        this.steeringAngle = THREE.MathUtils.lerp(this.steeringAngle, targetSteeringAngle, this.wheelTurnSpeed);

        // --- TÍNH TOÁN MÔ-MEN XOẮN LÁI THỰC TẾ ĐỂ TRUYỀN CHO HỆ THỐNG VẬT LÝ ---
        // Mô-men xoắn lái nên tỷ lệ với steeringAngle và tốc độ hiện tại của xe
        const baseSteeringTorque = 80; // Mô-men xoắn cơ bản, TÙY CHỈNH GIÁ TRỊ NÀY
        const currentCarSpeed = this.carGroup.userData.velocity.length(); // Lấy tốc độ thực từ vật lý
        this.steeringTorque = this.steeringAngle * baseSteeringTorque * Math.min(1, currentCarSpeed / (this.maxSpeed * this.boostMultiplier * 20)); // Chia cho một giá trị lớn hơn maxSpeed để đạt được 1 ở tốc độ cao
        // Điều chỉnh hệ số này để lái dễ hơn hoặc khó hơn ở tốc độ thấp
        if (currentCarSpeed < 0.1) { // Rẽ chậm khi xe gần dừng
            this.steeringTorque *= 0.1;
        }
        
        // --- Audio & Light Handling based on key presses ---
        const isMoving = Math.abs(this.carGroup.userData.velocity.length()) > 0.05; // Sử dụng vận tốc thực tế của xe

        if (this.soundManager) { // Đảm bảo soundManager đã được khởi tạo

            // Background
            this.soundManager.playBackGroundSound();

            // Brake
            if (isBraking && isMoving) { // Chỉ phát tiếng phanh khi đang nhấn phanh VÀ xe đang di chuyển
                this.soundManager.playBrakeSound();
            } else if ((!isBraking || !isMoving) && this.soundManager.brakeSound && this.soundManager.brakeSound.isPlaying) {
                // Dừng tiếng phanh nếu không còn nhấn phanh hoặc xe đã dừng
                this.soundManager.brakeSound.stop();
            }

            // Horn
            const isHornKeyPressedNow = currentKeyState['h'];
            this.soundManager.manageHornSound(isHornKeyPressedNow);

            // Engine
            this.soundManager.updateEngineSound(
                isMoving, isBoosting,
                this.carGroup 
            );
        }

        // Lights
        if (currentKeyState['f'] && !this.previousKeyState['f']) {
            this.toggleHeadlights();
        }
        
        // Lưu trạng thái phím hiện tại cho lần update tiếp theo
        this.previousKeyState = currentKeyState;
    }

    // === LOẠI BỎ HÀM _applyMovement() VÌ LOGIC DI CHUYỂN DO HỆ THỐNG VẬT LÝ ĐẢM NHẬN ===
    // Thay vào đó, chúng ta sẽ cập nhật trực tiếp bánh xe dựa trên steeringAngle và vận tốc
    _updateWheelVisuals() {
        // Cập nhật góc quay của bánh trước
        if (this.frontWheel_L) {
            this.frontWheel_L.rotation.y = this.steeringAngle; // Không còn đảo dấu
        }
        if (this.frontWheel_R) {
            this.frontWheel_R.rotation.y = this.steeringAngle; // Không còn đảo dấu
        }
        
        // Cập nhật tốc độ lăn của bánh xe dựa trên vận tốc tuyến tính của xe
        const carVelocity = this.carGroup.userData.velocity;
        const forwardVector = new THREE.Vector3(0, 0, 1).applyQuaternion(this.carGroup.quaternion);
        // Tốc độ lăn của bánh xe tỷ lệ với vận tốc của xe theo hướng tiến
        const wheelRotationSpeed = carVelocity.dot(forwardVector) / this.wheelRadius;

        if (this.wheel_L) {
            this.wheel_L.rotation.x += wheelRotationSpeed;   
        }
        if (this.wheel_R) {
            this.wheel_R.rotation.x += wheelRotationSpeed;   
        }
        if (this.backWheels) { 
            this.backWheels.rotation.x += wheelRotationSpeed;   
        }
    }

    // === CẬP NHẬT HÀM UPDATE ===
    update(keyState, deltaTime) {
        this._processInput(keyState, deltaTime); 
        this._updateWheelVisuals(); // Cập nhật hình ảnh bánh xe
    }

    // === THÊM HÀM MỚI ĐỂ TRẢ VỀ CÁC LỰC VÀ MÔ-MEN XOẮN CHO PHYSICS MANAGER ===
    getAppliedForces() {
        return {
            engineForce: this.engineForce,
            steeringTorque: this.steeringTorque
        };
    }
}