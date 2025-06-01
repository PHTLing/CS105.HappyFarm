// controller.js
import * as THREE from 'three';
import { SoundManager } from './sound.js';
import * as CANNON from 'cannon-es';

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
        this.engineForce = 0; // Lực động cơ
        this.maxEngineForce = 300; // Lực động cơ tối đa (N)
        this.brakeForce = 500; // Lực phanh (N)
        this.maxSteeringAngle = Math.PI / 6; // Góc lái tối đa (radians: 30 độ)
        this.steeringIncrement = 0.02; // Tốc độ xoay vô lăng

        // Audio and lights
        this.headlights = [];   // Mảng chứa các đối tượng đèn pha (THREE.SpotLight hoặc THREE.PointLight)
        this.headlightsOn = false;

        // Lưu trữ trạng thái phím trước đó để phát hiện sự kiện nhấn/nhả
        this.soundManager = null; 
        this.previousKeyState = {};

        // Biến để lưu trữ Cannon.Body của xe
        this.carBody = null; 
    }

    /**
     * Gán Cannon.Body của xe cho CarController.
     * @param {CANNON.Body} body The Cannon.js Body representing the car.
     */
    setCarBody(body) {
        this.carBody = body;
        // Đảm bảo carBody bắt đầu ở trạng thái không ngủ để nhận lực ngay lập tức
        if (this.carBody) {
            this.carBody.wakeUp();
        }
    }

    // Các hàm initAudio, initHeadlights, toggleHeadlights giữ nguyên

    /**
     * Khởi tạo các đối tượng âm thanh. Cần AudioListener và AudioLoader từ Three.js
     * @param {THREE.AudioListener} listener
     * @param {THREE.AudioLoader} audioLoader
     */
    async initAudio(listener, audioLoader) {
        this.soundManager = new SoundManager(listener, audioLoader);
        await this.soundManager.loadSounds(); // Đảm bảo âm thanh được tải xong
    }

    /**
     * Thêm các đối tượng đèn pha vào carGroup.
     * Cần tạo các đèn trong Three.js (ví dụ THREE.SpotLight) và thêm vào carGroup.
     */
    initHeadlights() {
        // Ví dụ tạo đèn pha (điểm sáng)
        const headlight1 = new THREE.PointLight(0xffff00, 5, 100);
        headlight1.position.set(1.2, 0.3, 3); // Điều chỉnh vị trí  1, 1, 2.8
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

    _processInput(keyState, deltaTime) {
        if (!this.carBody) return; // Đảm bảo có body để áp dụng lực

        const currentKeyState = { ...keyState };

        // --- Áp dụng lực cho Cannon.Body ---
        this.carBody.wakeUp(); // Đảm bảo body không ngủ khi có input

        let forwardForce = new CANNON.Vec3(0, 0, 0);
        let steeringAmount = 0; // Giá trị từ -1 đến 1 cho việc rẽ

        const isBraking = keyState[' '];
        const isBoosting = keyState['b'];

        // Điều khiển tiến/lùi
        if (keyState['w'] || keyState['arrowup']) {
            this.engineForce = this.maxEngineForce * (isBoosting ? 1.5 : 1);
            forwardForce = new CANNON.Vec3(0, 0, this.engineForce); // Lực theo trục Z cục bộ (tiến)
        } else if (keyState['s'] || keyState['arrowdown']) {
            this.engineForce = -this.maxEngineForce / 2; // Lùi chậm hơn
            forwardForce = new CANNON.Vec3(0, 0, this.engineForce); // Lực theo trục Z cục bộ (lùi)
        } else {
            this.engineForce = 0; // Không nhấn phím tiến/lùi
            // Áp dụng lực cản tự nhiên nếu không di chuyển
            // Cần điều chỉnh lực cản dựa trên vận tốc hiện tại
            const dampingForce = this.carBody.velocity.clone();
            dampingForce.x *= -0.1; // Hệ số cản nhỏ
            dampingForce.z *= -0.1;
            this.carBody.applyLocalForce(dampingForce, new CANNON.Vec3(0, 0, 0));
        }

        // Áp dụng lực phanh
        if (isBraking) {
            // Lực phanh ngược chiều vận tốc hiện tại
            const brakeVector = this.carBody.velocity.clone();
            brakeVector.normalize();
            brakeVector.x *= -this.brakeForce;
            brakeVector.z *= -this.brakeForce;
            this.carBody.applyLocalForce(brakeVector, new CANNON.Vec3(0, 0, 0));
            // Nếu xe đã dừng, đảm bảo vận tốc bằng 0 để tránh trượt
            if (this.carBody.velocity.length() < 0.1) {
                this.carBody.velocity.set(0, this.carBody.velocity.y, 0);
                this.carBody.angularVelocity.set(0, 0, 0);
            }
        }


        // Chuyển đổi lực cục bộ sang toàn cục
        const worldForwardForce = new CANNON.Vec3();
        this.carBody.quaternion.vmult(forwardForce, worldForwardForce);
        this.carBody.applyForce(worldForwardForce, this.carBody.position);


        // Điều khiển xoay/rẽ
        if (keyState['a'] || keyState['arrowleft']) {
            steeringAmount = -1; // Rẽ trái
        } else if (keyState['d'] || keyState['arrowright']) {
            steeringAmount = 1; // Rẽ phải
        } else {
            steeringAmount = 0;
        }

        // Cập nhật góc lái của bánh xe (visual)
        this.steeringAngle = THREE.MathUtils.lerp(this.steeringAngle, steeringAmount * this.maxSteeringAngle, this.steeringIncrement);

        // Áp dụng mô-men xoắn (torque) để xoay xe
        // Mô-men xoắn cần tỷ lệ thuận với tốc độ xe và góc lái
        const currentSpeedMagnitude = this.carBody.velocity.length();
        const torqueFactor = currentSpeedMagnitude * 50; // Điều chỉnh hệ số này
        const rotationForce = new CANNON.Vec3(0, -this.steeringAngle * torqueFactor, 0); // Torque quanh trục Y

        this.carBody.applyTorque(rotationForce);

        // --- Audio & Light Handling ---
        const isMoving = currentSpeedMagnitude > 0.5; // Ngưỡng để xác định xe đang di chuyển
        
        if (this.soundManager) {
            this.soundManager.playBackGroundSound();

            if (isBraking && currentSpeedMagnitude > 0.1) { // Chỉ phát tiếng phanh khi xe đang di chuyển và phanh
                this.soundManager.playBrakeSound();
            } else if (!isBraking && this.soundManager.brakeSound && this.soundManager.brakeSound.isPlaying) {
                this.soundManager.brakeSound.stop();
            }

            const isHornKeyPressedNow = currentKeyState['h'];
            this.soundManager.manageHornSound(isHornKeyPressedNow);

            this.soundManager.updateEngineSound(
                isMoving, isBoosting,
                this.carGroup
            );
        }

        // Lights
        if (currentKeyState['f'] && !this.previousKeyState['f']) {
            this.toggleHeadlights();
        }

        this.previousKeyState = currentKeyState;
    }

    _applyMovement() {
        // Cập nhật góc xoay bánh xe (visual)
        if (this.frontWheel_L) {
            this.frontWheel_L.rotation.y = this.steeringAngle; 
        }
        if (this.frontWheel_R) {
            this.frontWheel_R.rotation.y = this.steeringAngle; 
        }
        
        // Cập nhật góc lăn bánh xe (visual)
        // Tính toán dựa trên vận tốc hiện tại của Cannon.Body
        const currentSpeedMagnitude = this.carBody ? this.carBody.velocity.length() : 0;
        const wheelRotationSpeed = (currentSpeedMagnitude / (2 * Math.PI * 0.5)) * Math.PI * 2 * 0.05; // Hệ số để tốc độ lăn trông hợp lý

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

    update(keyState, deltaTime) {
        this._processInput(keyState, deltaTime);
        this._applyMovement();
    }
}