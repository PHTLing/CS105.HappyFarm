import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Loads the car model and sets its initial properties.
 * It now expects a hierarchy where steering pivots are parents of the wheel meshes.
 * @returns {Promise<{carGroup: THREE.Object3D, frontWheel_L: THREE.Object3D, frontWheel_R: THREE.Object3D, wheel_L: THREE.Object3D, wheel_R: THREE.Object3D, backWheels: THREE.Object3D, backRightWheelMesh: THREE.Object3D}>} 
 * A promise that resolves with an object containing the main car group, steering pivots, and actual wheel meshes.
 */
export function createCar() {
    const loader = new GLTFLoader();
    const carModelUrl = '/assets/Truck.glb'; 

    return new Promise((resolve, reject) => {
        loader.load(
            carModelUrl,
            (gltf) => {
                const carGroup = gltf.scene; 
                carGroup.rotateY(Math.PI); // Rotate the model if needed to face forward
                carGroup.scale.set(1, 1, 1); 
                
                const bbox = new THREE.Box3().setFromObject(carGroup);
                carGroup.position.y = -bbox.min.y; 
                
                // --- Find the steering pivot objects (the "transparent boxes" / Empties) ---
                // IMPORTANT: You MUST name these pivot objects in Blender (e.g., 'frontWheel_L', 'frontWheel_R')
                // and place them as parents to your actual wheel meshes.
                const frontWheel_L = carGroup.getObjectByName('FrontWheel_L'); 
                const frontWheel_R = carGroup.getObjectByName('FrontWheel_R'); 

                // --- Find the actual wheel meshes (children of the pivots or directly for rear wheels) ---
                // If the wheel meshes are direct children of the steering pivots:
                const wheel_L = frontWheel_L ? frontWheel_L.getObjectByName('Wheel_L') : null; 
                const wheel_R = frontWheel_R ? frontWheel_R.getObjectByName('Wheel_R') : null; 

                // Rear wheels might not have a steering pivot, so they are found directly under carGroup
                const backWheels = carGroup.getObjectByName('BackWheels'); // Adjust name if different in your model


                if (!frontWheel_L || !frontWheel_R || !wheel_L || !wheel_R || !backWheels) {
                    console.warn("Could not find steering pivot objects or wheel meshes. Steering/Rolling might not work as expected.");
                    console.warn("Please check your GLTF model's hierarchy and object names in Blender.");
                    console.warn("Expected names: 'frontWheel_L', 'frontWheel_R', 'wheel_L', wheel_R', 'backWheels'"); 
                    resolve({ 
                        carGroup: carGroup, 
                        frontWheel_L: null, frontWheel_R: null, 
                        wheel_L: null, wheel_R: null,
                        backWheels: null
                    });
                    return;
                }
                
                resolve({ 
                    carGroup, frontWheel_L, frontWheel_R, wheel_L, wheel_R, backWheels  
                }); 
            },
            undefined, 
            (error) => {
                console.error('Error loading car model:', error);
                reject(error); 
            }
        );
    });
}

/**
 * CarController class manages the movement and rotation logic of the car.
 */
export class CarController {
    constructor({ carGroup, frontWheel_L, frontWheel_R, wheel_L, wheel_R, backWheels }) {
        this.carGroup = carGroup; 
        this.frontWheel_L = frontWheel_L;   // The parent object for steering
        this.frontWheel_R = frontWheel_R;   
        this.wheel_L = wheel_L;             // The actual wheel mesh
        this.wheel_R = wheel_R;            
        this.backWheels = backWheels;       // Rear wheel mesh

        // Movement speed parameters
        this.currentSpeed = 0;
        this.maxSpeed = 0.2;
        this.acceleration = 0.02;
        this.deceleration = 0.005;
        this.brakeDeceleration = 0.01;
        this.boostMultiplier = 2;

        // Rotation speed parameters for car body
        this.currentRotationSpeed = 0; 
        this.maxRotationSpeed = 0.02; 
        this.rotationAcceleration = 0.004; 
        this.rotationDeceleration = 0.008; 
        this.driftFactor = 2; 

        // Steering parameters for front wheels
        this.steeringAngle = 0; 
        this.maxSteeringAngle = Math.PI / 6; // Max steering angle: 30 degrees in radians
        this.wheelTurnSpeed = 0.05; 
        this.carTurnSensitivity = 0.8; 
        this.wheelbase = 3.0; 
        this.wheelRadius = 0.5; 
    }

    _processInput(keyState) {
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
        // Update rotation
        let targetSteeringAngle = 0; 
        if (keyState['a'] || keyState['arrowleft']) { 
            targetSteeringAngle = -this.maxSteeringAngle; 
        } else if (keyState['d'] || keyState['arrowright']) { 
            targetSteeringAngle = this.maxSteeringAngle; 
        } 
        this.steeringAngle = THREE.MathUtils.lerp(this.steeringAngle, targetSteeringAngle, this.wheelTurnSpeed);

        // --- Tính toán tốc độ xoay của thân xe dựa trên góc lái và tốc độ ---
        const minSpeedForTurn = 0.01; 
        if (Math.abs(this.currentSpeed) > minSpeedForTurn && Math.abs(this.steeringAngle) > 0.001) { 
            //this.currentRotationSpeed = (this.currentSpeed * Math.sin(this.steeringAngle) / this.wheelbase);
            let rotationBaseSpeed = (this.currentSpeed * Math.sin(this.steeringAngle) / this.wheelbase);
    
            // Áp dụng carTurnSensitivity
            this.currentRotationSpeed = rotationBaseSpeed * this.carTurnSensitivity;
            
            // Điều chỉnh ảnh hưởng của drift:
            if (isDrifting) {
                // Option 1: Tăng cường độ xoay nhưng có giới hạn hoặc làm mịn
                // Ví dụ: chỉ tăng thêm một phần nhỏ của driftFactor, không phải nhân đôi hoàn toàn
                //this.currentRotationSpeed += Math.sign(this.currentRotationSpeed) * (this.driftFactor - 1) * Math.abs(rotationBaseSpeed) * 0.05; // Điều chỉnh 0.5 để kiểm soát mức độ tăng
                
                // Option 2 (nếu Option 1 vẫn quá mạnh): giới hạn rotationSpeed khi drift
                this.currentRotationSpeed = THREE.MathUtils.clamp(this.currentRotationSpeed, -this.maxRotationSpeed * this.driftFactor, this.maxRotationSpeed * this.driftFactor);
            }
            this.currentRotationSpeed = THREE.MathUtils.clamp(this.currentRotationSpeed, -this.maxRotationSpeed, this.maxRotationSpeed);


        } else {
            this.currentRotationSpeed = 0;
        }

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
