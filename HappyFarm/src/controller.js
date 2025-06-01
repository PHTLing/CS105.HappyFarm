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
        this.maxSpeed = 0.2;
        this.acceleration = 0.02;
        this.deceleration = 0.005;
        this.brakeDeceleration = 0.01;
        this.boostMultiplier = 1.5;

        // Rotation speed parameters for left/right turn
        this.currentRotationSpeed = 0; 
        this.maxRotationSpeed = 0.02; 
        this.rotationAcceleration = 0.004; 
        this.rotationDeceleration = 0.008; 
        // this.driftFactor = 2; 

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

    _processInput(keyState) {
        // Copy current state
        const currentKeyState = { ...keyState };

        const isBoosting = keyState['b']; 
        const isBraking = keyState[' ']; 
        const isDrifting = isBoosting && (keyState['a'] || keyState['d'] || keyState['arrowleft'] || keyState['arrowright']);

        //--- Logic Update speed ---
        // Update Move forward speed
        if (keyState['w'] || keyState['arrowup']) {
            let boost = isBoosting ? this.boostMultiplier : 1;
            if (isBraking) { 
                this.currentSpeed -= this.brakeDeceleration / 3;
                if (this.currentSpeed < 0) this.currentSpeed = 0;
            } else {
                if (this.currentSpeed > this.maxSpeed * boost) {
                    this.currentSpeed = this.maxSpeed * boost;
                } else {
                    this.currentSpeed += this.acceleration * boost;
                }
            }
        } 
        // Update Move backward speed
        else if (keyState['s'] || keyState['arrowdown']) {
            if (isBraking) { 
                this.currentSpeed += this.brakeDeceleration / 6;
                if (this.currentSpeed > 0) this.currentSpeed = 0;
            } else {
                if (this.currentSpeed < -this.maxSpeed / 2) {
                    this.currentSpeed = -this.maxSpeed / 2;
                } else {
                    this.currentSpeed -= this.acceleration / 4;
                }
            }
        }
        // No key is pressed
        else { 
            if (this.currentSpeed > 0) {
                this.currentSpeed -= this.deceleration;
                if (this.currentSpeed < 0) this.currentSpeed = 0;
            } else if (this.currentSpeed < 0) {
                this.currentSpeed += this.deceleration / 2;
                if (this.currentSpeed > 0) this.currentSpeed = 0;
            }
        }

        // --- Logic Update rotation ---
        // Update Steering Angle
        let targetSteeringAngle = 0; 
        if (keyState['a'] || keyState['arrowleft']) { 
            targetSteeringAngle = -this.maxSteeringAngle; 
        } else if (keyState['d'] || keyState['arrowright']) { 
            targetSteeringAngle = this.maxSteeringAngle; 
        } 
        this.steeringAngle = THREE.MathUtils.lerp(this.steeringAngle, targetSteeringAngle, this.wheelTurnSpeed);

        // Calculate the vehicle's rotation speed based on the steering angle and speed
        const minSpeedForTurn = 0.01; 
        if (Math.abs(this.currentSpeed) > minSpeedForTurn && Math.abs(this.steeringAngle) > 0.001) { 
            this.currentRotationSpeed = (this.currentSpeed * Math.sin(this.steeringAngle) / this.wheelbase) * this.carTurnSensitivity;
        } else {
            this.currentRotationSpeed = 0;
        }
        // No key is pressed
        if (!keyState['a'] && !keyState['d'] && !keyState['arrowleft'] && !keyState['arrowright']) {
            if (Math.abs(this.currentRotationSpeed) > 0.0001) { 
                if (this.currentRotationSpeed > 0) {
                    this.currentRotationSpeed -= this.rotationDeceleration;
                    if (this.currentRotationSpeed < 0) this.currentRotationSpeed = 0;
                } else {
                    this.currentRotationSpeed += this.rotationDeceleration / 2; 
                    if (this.currentRotationSpeed > 0) this.currentRotationSpeed = 0;
                }
            } else {
                this.currentRotationSpeed = 0; 
            }
        }

        // --- Audio & Light Handling based on key presses ---
        const isMoving = Math.abs(this.currentSpeed) > 0.01; // Vẫn dùng currentSpeed để xác định isMoving
        
        if (this.soundManager) { // Đảm bảo soundManager đã được khởi tạo

            // Background
            this.soundManager.playBackGroundSound();

            // Brank
            if (isBraking && this.currentSpeed !== 0) {
                this.soundManager.playBrakeSound();
            } else if (!isBraking && this.soundManager.brakeSound && this.soundManager.brakeSound.isPlaying) {
                // Dừng tiếng phanh nếu không còn nhấn phanh hoặc xe đã dừng
                this.soundManager.brakeSound.stop();
            }

            // Horn
            const isHornKeyPressedNow = currentKeyState['h'];
            this.soundManager.manageHornSound(isHornKeyPressedNow);

            // Engine
            this.soundManager.updateEngineSound(
                isMoving, isBoosting,
                this.carGroup // Truyền carGroup vào để gắn PositionalAudio
            );
        }

        // Lights
        if (currentKeyState['f'] && !this.previousKeyState['f']) {
            this.toggleHeadlights();
        }

        
        
        // Lưu trạng thái phím hiện tại cho lần update tiếp theo
        this.previousKeyState = currentKeyState;

    }

    _applyMovement() {
        // 1. Steering Angle
        if (this.frontWheel_L) {
            this.frontWheel_L.rotation.y = -this.steeringAngle; 
        }
        if (this.frontWheel_R) {
            this.frontWheel_R.rotation.y = -this.steeringAngle; 
        }
        
        // 2. Rotation pickup (body car) 
        this.carGroup.rotation.y += this.currentRotationSpeed;
        
        // 3. Accumulating vector of car in world space
        const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.carGroup.quaternion);
        
        // 4. Move carGroup
        this.carGroup.position.add(forward.multiplyScalar(this.currentSpeed));

        // 5. Rolling the wheels
        const wheelRotationSpeed = this.currentSpeed / this.wheelRadius;

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

    update(keyState) {
        this._processInput(keyState); 
        this._applyMovement();        
    }
}
