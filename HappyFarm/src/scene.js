import * as THREE from 'three';
import { createCamera } from './camera.js';
import { CarController } from './controller.js';
import { createCar, createFarm, createGround } from './objects.js';
import { ObjectManager } from './objects.js';
import { CollisionManager } from './collision.js'; 
// import { CollisionManager } from './collision_test.js';

export async function createScene() {
    // Initial scene setup
    const gameWindow = document.getElementById('render-target');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x00000);

    // Camera
    const cameraController = createCamera(gameWindow);
    const camera = cameraController.camera;
    camera.position.set(10, 10, 10);
    camera.lookAt(0, 0, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true }); // Thêm antialias để render mượt hơn
    renderer.setSize(gameWindow.clientWidth, gameWindow.clientHeight);
    renderer.shadowMap.enabled = true; // Bật đổ bóng
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Loại đổ bóng mềm mại hơn
    gameWindow.appendChild(renderer.domElement);

    // AudioListener & AudioLoader ---
    const listener = new THREE.AudioListener();
    camera.add(listener);
    const audioLoader = new THREE.AudioLoader();

    // Lighting
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(5, 10, 5);
    scene.add(light);

    // Sun light
    const sunLight = new THREE.DirectionalLight(0xffffff, 1);
    sunLight.position.set(0,0,0);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 50;
    sunLight.shadow.camera.left = -5;
    sunLight.shadow.camera.right = 5;
    sunLight.shadow.camera.top = 5;
    sunLight.shadow.camera.bottom = -5;
    scene.add(sunLight);

    //Ground
    const ground = createGround(100, 100, new THREE.Color(0x00ff99) )
    scene.add(ground);

    //Load map 
    const Farm = await createFarm(); // Gọi hàm createFarm
    scene.add(Farm); 

    // Car
    const { carGroup, frontWheel_L, frontWheel_R, wheel_L, wheel_R, backWheels } = await createCar(); 
    scene.add(carGroup); 
    
    // Camera follow car
    const carController = new CarController({ carGroup, frontWheel_L, frontWheel_R, wheel_L, wheel_R, backWheels }); // Pass all car parts to controller
    cameraController.setTarget(carGroup); 
    cameraController.setFollowMode(true);

    // init CarController và SoundManager bên trong nó
    await carController.initAudio(listener, audioLoader); 
    carController.initHeadlights();

    // worldGroup (include terrain, objects)
    const worldGroup = new THREE.Group();
    scene.add(worldGroup);


    // init objectManager 
    const objectManager = new ObjectManager(scene, worldGroup);


    // Tạo các hộp sử dụng ObjectManager
    // const box = objectManager.createBox(5, 0, -5, 2, 10, new THREE.Color(0x3333ff)); 
    // const box1 = objectManager.createBox(5, 5, -5, 1, 100, new THREE.Color(0x3333ff)); 
    objectManager.createBox1(5, 0, -5, 1, 1, new THREE.Color(0x3333ff)); 

    objectManager.createBox(4, 2, -3, 1, 2, new THREE.Color(0xff3333)); 
    objectManager.createBox(4, 2, -2, 1, 500, new THREE.Color(0xff3333)); 

    objectManager.createBox(4, 0, 0, 1, 1, new THREE.Color(0xffff33)); 
    objectManager.createBox(4, 2, 0, 1, 1, new THREE.Color(0xffff33)); 
    objectManager.createBox(4, 4, 0, 1, 1, new THREE.Color(0xffff33)); 
    objectManager.createBox(4, 6, 0, 1, 1, new THREE.Color(0xffff33)); 
    objectManager.createBox(4, 0, 2, 1, 1, new THREE.Color(0xff33ff)); 
    objectManager.createBox(4, 2 , 2, 1, 1, new THREE.Color(0xff33ff)); 
    objectManager.createBox(4, 4, 2, 1, 1, new THREE.Color(0xff33ff)); 
    objectManager.createBox(4, 6 , 2, 1, 1, new THREE.Color(0xff33ff)); 

    objectManager.createCylinder(4, 1, 4, 1, 2, 12, 1, new THREE.Color(0x33ffff)); 
   
    
    // list objects
    const interactiveObjects = objectManager.getInteractiveObjects();


    // init collisionManager
    // Add carGroup & objects
    const collisionManager = new CollisionManager(carGroup, interactiveObjects);

    // Input key state
    const keyState = {}

    window.addEventListener('keydown', (e) => {
        keyState[e.key.toLowerCase()] = true;
    });
    window.addEventListener('keyup', (e) => {
        keyState[e.key.toLowerCase()] = false;
    });

    function update() {
        carController.update(keyState);

        // Update position sunlight follow carGroup
        const lightYOffset = 15; 
        const lightXOffset = -10; 
        const lightZOffset = 10; 
        sunLight.position.copy(carGroup.position);
        sunLight.position.y += lightYOffset;
        sunLight.position.x += lightXOffset;
        sunLight.position.z += lightZOffset;
        
        // Điều chỉnh điểm mà sunLight đang nhìn (target) để nó luôn nhìn vào xe
        sunLight.target.position.copy(carGroup.position);
        sunLight.target.updateMatrixWorld(); // Cập nhật vị trí target trong ma trận thế giới
    
        // Update collision
        collisionManager.updateCollisions();
    
    }

    function updateCamera() {
        const distance = 10; //8
        const angle = 3 * Math.PI / 4; // 45 degrees
        
        const offset = new THREE.Vector3(
            Math.cos(angle) * distance, // x
            Math.sin(angle - 45) * distance, // y = 0
            Math.cos(angle) * distance  // z
        );

        const desiredPosition = new THREE.Vector3().copy(carGroup.position).add(offset);
        camera.position.lerp(desiredPosition, 0.1);
        camera.lookAt(carGroup.position);
    }

    function drawScene() {
        update();
        updateCamera();
        renderer.render(scene, camera);
    }

    function start() {
        renderer.setAnimationLoop(drawScene);
    }

    function stop() {
        renderer.setAnimationLoop(null);
    }

    function onMouseDown(event) {
        cameraController.onMouseDown(event);
    }
    
    function onMouseUp(event) {
        cameraController.onMouseUp(event);
    }

    function onMouseMove(event) {
        cameraController.onMouseMove(event);
    }
    return {
        start,
        stop,
        onMouseDown,
        onMouseUp,
        onMouseMove
    };
}
