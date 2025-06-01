import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Loads the car model and sets its initial properties.
 * @returns {Promise<{carGroup: THREE.Object3D, frontLeftWheel: THREE.Object3D, frontRightWheel: THREE.Object3D}>} 
 * A promise that resolves with an object containing the main car group and references to its front wheels.
 */
export function createCar() {
    // Load car model
    const loader = new GLTFLoader();
    const carModelUrl = '/assets/Truck.glb'; // Corrected: ensure it's .glb, not .glb.glb

    return new Promise((resolve, reject) => {
        loader.load(
            carModelUrl,
            (gltf) => {
                const carGroup = gltf.scene; // This will be the main car body group (likely the RootNode)
                carGroup.rotateY(Math.PI); // Rotate the model if needed to face forward
                carGroup.scale.set(1, 1, 1); // Adjust car scale (assuming this is the desired final scale)
                
                // --- Calculate correct initial Y position based on model's actual height ---
                // 1. Compute the bounding box of the entire carGroup after scaling.
                // This is crucial to get the real dimensions of the loaded model.
                const bbox = new THREE.Box3().setFromObject(carGroup);
                
                // 2. Set the initial Y position of the carGroup so its bottom is at y=0.
                // By adding -bbox.min.y, we lift the car so its lowest point (bbox.min.y) aligns with y=0.
                carGroup.position.y = -bbox.min.y; 
                
                // Optional: If you want the car to be slightly above the ground (e.g., 0.25 unit), add it here
                // carGroup.position.y += 0.25; // Uncomment and adjust if you need an offset from y=0

                // --- Find specific car parts (Front Wheels) ---
                // IMPORTANT: These names must match the actual names in your Truck.glb file.
                // Based on your provided image, the names are 'FrontWheel_L' and 'FrontWheel_R'.
                const frontLeftWheel = carGroup.getObjectByName('FrontWheel_L'); 
                const frontRightWheel = carGroup.getObjectByName('FrontWheel_R'); 
                // Also find rear wheels for rolling animation
                const backWheels = carGroup.getObjectByName('BackWheels'); // Assuming default names, adjust if needed


                if (!frontLeftWheel || !frontRightWheel) {
                    console.warn("Could not find front wheel objects by name. Steering might not work as expected.");
                    console.warn("Please check your GLTF model's hierarchy and object names in Blender.");
                    console.warn("Expected names: 'FrontWheel_L', 'FrontWheel_R', BackWheels"); 
                    // Fallback: if wheels not found, just return the main carGroup
                    resolve({ carGroup: carGroup, frontLeftWheel: null, frontRightWheel: null, backWheels: null});
                    return;
                }
                
                resolve({ carGroup, frontLeftWheel, frontRightWheel, backWheels }); // Resolve with car group and wheel references
            },
            undefined, // Callback for loading progress (can be added if needed)
            (error) => {
                console.error('Error loading car model:', error);
                reject(error); // Reject the promise if there's an error
            }
        );
    });
}

/**
 * CarController class manages the movement and rotation logic of the car.
 */
export class CarController {
    /**
     * @param {Object} carParts An object containing the main car group and references to its front wheels.
     * @param {THREE.Object3D} carParts.carGroup The main Three.js group representing the car body.
     * @param {THREE.Object3D} carParts.frontLeftWheel The Three.js object for the front left wheel.
     * @param {THREE.Object3D} carParts.frontRightWheel The Three.js object for the front right wheel.
     * @param {THREE.Object3D} carParts.backWheels The Three.js object for the back left wheel.
     */
    constructor({ carGroup, frontLeftWheel, frontRightWheel, backWheels }) {
        this.carGroup = carGroup; // Main car group (body and overall position/rotation)
        this.frontLeftWheel = frontLeftWheel;
        this.frontRightWheel = frontRightWheel;
        this.backWheels = backWheels;   // Added back wheels

        // Movement speed parameters
        this.currentSpeed = 0;
        this.maxSpeed = 0.2;
        this.acceleration = 0.02;
        this.deceleration = 0.005;
        this.brakeDeceleration = 0.01;
        this.boostMultiplier = 2;

        // Rotation speed parameters for car body (yaw)
        this.currentRotationSpeed = 0; 
        this.maxRotationSpeed = 0.02; 
        this.rotationAcceleration = 0.004; 
        this.rotationDeceleration = 0.008; 
        this.driftFactor = 2; // Drift coefficient

        // Steering parameters for front wheels
        this.steeringAngle = 0; // Current steering angle of the front wheels (local Z rotation for your model)
        this.maxSteeringAngle = Math.PI / 6; // Max steering angle: 30 degrees in radians (Math.PI / 6 = 30 degrees)
        this.wheelTurnSpeed = 0.05; // How fast the wheels turn to target steering angle (reduced for smoother transition)
        this.carTurnSensitivity = 0.8; // How much the car body turns based on steering angle and speed (increased for responsiveness)
        this.wheelbase = 3.0; // Khoảng cách giữa trục bánh trước và trục bánh sau của xe (tùy chỉnh theo model của bạn)
                               // Giá trị này rất quan trọng để tính toán bán kính quay chính xác.
        this.wheelRadius = 0.5; // Bán kính của bánh xe (tùy chỉnh theo model của bạn)
                                // Quan trọng để tính toán tốc độ quay của bánh xe khi xe di chuyển.
    }

    /**
     * Processes keyboard input to update the car's current speed and rotation speed.
     * This method calculates the desired velocities based on user input.
     * @param {Object.<string, boolean>} keyState An object containing the current state of pressed keys.
     * @private
     */
    _processInput(keyState) {
        const isBoosting = keyState['shiftleft']; // Left Shift key -> Boost
        const isBraking = keyState[' ']; // Space key -> Stop
        // Left Shift + A/D key -> Boost Move
        const isDrifting = isBoosting && (keyState['a'] || keyState['d'] || keyState['arrowleft'] || keyState['arrowright']);

        //--- Logic Update speed ---

        // Update Move forward speed
        if (keyState['w'] || keyState['arrowup']) {
            // accumulating acceleration when boost
            // acceleration = acceleration * boostMultiplier
            let boost = isBoosting ? this.boostMultiplier : 1;

            // Brake Stop 
            if (isBraking) { 
                this.currentSpeed -= this.brakeDeceleration/3;
                if (this.currentSpeed < 0) this.currentSpeed = 0;
            }
            // Limited speed
            else {
                if (this.currentSpeed > this.maxSpeed * boost) {
                    this.currentSpeed = this.maxSpeed * boost;
                } else {
                    this.currentSpeed += this.acceleration * boost;
                }
            }
        } 
        // Update Move backward speed
        else if (keyState['s'] || keyState['arrowdown']) {
            // Brake Stop 
            if (isBraking) { 
                this.currentSpeed += this.brakeDeceleration;
                if (this.currentSpeed > 0) this.currentSpeed = 0;
            }
            // Limited speed
            else {
                if (this.currentSpeed < -this.maxSpeed / 2) {
                    this.currentSpeed = -this.maxSpeed / 2;
                } else {
                    this.currentSpeed -= this.acceleration / 6;
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

        // --- Logic cập nhật góc lái bánh xe (this.steeringAngle) ---

        let targetSteeringAngle = 0; // Góc lái mục tiêu của bánh xe

        // Xác định góc lái mục tiêu dựa trên input rẽ
        if (keyState['a'] || keyState['arrowleft']) { 
            targetSteeringAngle = -this.maxSteeringAngle; // Rẽ trái
        } else if (keyState['d'] || keyState['arrowright']) { 
            targetSteeringAngle = this.maxSteeringAngle; // Rẽ phải
        } 
        // else: targetSteeringAngle vẫn là 0 (đi thẳng)

        // Làm mượt quá trình chuyển đổi góc lái của bánh xe
        this.steeringAngle = THREE.MathUtils.lerp(this.steeringAngle, targetSteeringAngle, this.wheelTurnSpeed);

        // --- Tính toán tốc độ xoay của thân xe (yaw rate) dựa trên góc lái và tốc độ ---
        // Xe chỉ xoay khi đang di chuyển
        const minSpeedForTurn = 0.01; // Ngưỡng tốc độ tối thiểu để xe có thể xoay
        if (Math.abs(this.currentSpeed) > minSpeedForTurn && Math.abs(this.steeringAngle) > 0.001) { // Chỉ xoay nếu đang di chuyển và bánh xe có góc lái
            // Công thức gần đúng cho tốc độ xoay (yaw rate) dựa trên Ackerman steering
            // yawRate = (tốc độ tiến * sin(góc lái)) / wheelbase
            // carTurnSensitivity được sử dụng như một hệ số điều chỉnh để tinh chỉnh độ nhạy
            this.currentRotationSpeed = (this.currentSpeed * Math.sin(this.steeringAngle) / this.wheelbase) * this.carTurnSensitivity;
            
            // Xử lý Drift: Tăng tốc độ xoay của thân xe khi drift
            if (isDrifting) {
                this.currentRotationSpeed *= this.driftFactor;
            }
        } else {
            // Nếu xe gần như đứng yên hoặc bánh xe thẳng, không cho phép xe xoay
            this.currentRotationSpeed = 0;
        }

        // Giảm tốc độ xoay của thân xe khi không có input rẽ (tự động thẳng lái)
        if (!keyState['a'] && !keyState['d'] && !keyState['arrowleft'] && !keyState['arrowright']) {
            // Nếu currentRotationSpeed vẫn còn (do quán tính), giảm dần
            if (Math.abs(this.currentRotationSpeed) > 0.0001) { // Ngưỡng nhỏ để tránh lỗi dấu phẩy động
                if (this.currentRotationSpeed > 0) {
                    this.currentRotationSpeed -= this.rotationDeceleration;
                    if (this.currentRotationSpeed < 0) this.currentRotationSpeed = 0;
                } else {
                    this.currentRotationSpeed += this.rotationDeceleration / 2; 
                    if (this.currentRotationSpeed > 0) this.currentRotationSpeed = 0;
                }
            } else {
                this.currentRotationSpeed = 0; // Đảm bảo về 0 hẳn
            }
        }
    }

    /**
     * Applies the calculated speed and rotation to the car's position and rotation.
     * This method handles the actual movement of the car in the 3D scene.
     * @private
     */
    _applyMovement() {
        // 1. Áp dụng góc lái vào rotation.z cục bộ của bánh xe trước
        if (this.frontLeftWheel) {
            this.frontLeftWheel.rotation.z = -this.steeringAngle; 
        }
        if (this.frontRightWheel) {
            this.frontRightWheel.rotation.z = -this.steeringAngle; // Đổi dấu cho bánh phải
        }
        // Bánh sau không cần thay đổi rotation.z cục bộ cho việc lái

        // 2. Áp dụng xoay thân xe (yaw)
        this.carGroup.rotation.y += this.currentRotationSpeed;
        
        // 3. Tính toán vector hướng tiến của xe trong không gian thế giới (world space)
        const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.carGroup.quaternion);
        
        // 4. Áp dụng di chuyển vào vị trí của xe
        this.carGroup.position.add(forward.multiplyScalar(this.currentSpeed));

        // 5. Áp dụng quay (lăn) cho tất cả các bánh xe
        // Tốc độ quay của bánh xe = (tốc độ tuyến tính của xe) / (2 * PI * bán kính bánh xe)
        // Hoặc đơn giản hơn: tốc độ quay = tốc độ / bán kính
        const wheelRotationSpeed = this.currentSpeed / this.wheelRadius;

        // Trục quay của bánh xe khi lăn thường là trục X hoặc Y cục bộ của bánh xe,
        // tùy thuộc vào cách model được tạo. Tôi sẽ giả định là trục X cục bộ.
        // Nếu bánh xe quay sai, bạn có thể thử đổi sang trục Y cục bộ.
        if (this.frontLeftWheel) {
            // this.frontLeftWheel.rotation.x += wheelRotationSpeed;
            //  this.frontLeftWheel.rotation.y += wheelRotationSpeed;
        }
        if (this.frontRightWheel) {
            // this.frontRightWheel.rotation.x += wheelRotationSpeed;
            // this.frontRightWheel.rotation.z += wheelRotationSpeed;
        }
        if (this.backWheels) { // Assuming you also want rear wheels to roll
            this.backWheels.rotation.x += wheelRotationSpeed;
        }
    }

    /**
     * Main update method for the CarController, called each frame.
     * It processes input and then applies the resulting movement.
     * @param {Object.<string, boolean>} keyState An object containing the current state of pressed keys.
     */
    update(keyState) {
        this._processInput(keyState); 
        this._applyMovement();        
    }
}
