import * as THREE from 'three';
import { createCamera } from './camera.js';
import { CarController } from './controller.js';
import { createCar, createFarm, createGround } from './objects.js';
import { ObjectManager } from './objects.js';

export async function createScene() {
    // Initial scene setup
    const gameWindow = document.getElementById('render-target');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // Camera
    const cameraController = createCamera(gameWindow);
    const camera = cameraController.camera;
    camera.position.set(-20, 10, -20);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.AxesHelper(10));

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(gameWindow.clientWidth, gameWindow.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    gameWindow.appendChild(renderer.domElement);

    // AudioListener & AudioLoader
    const listener = new THREE.AudioListener();
    camera.add(listener);
    const audioLoader = new THREE.AudioLoader();

    // Lighting (Ánh sáng chính)
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);

    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(5, 10, 5);
    scene.add(light);

    // Sun light (Ánh sáng mặt trời)
    const sunLight = new THREE.DirectionalLight(0xffffff, 1);
    sunLight.position.set(0, 15, 0);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 50;
    sunLight.shadow.camera.left = -20;
    sunLight.shadow.camera.right = 20;
    sunLight.shadow.camera.top = 20;
    sunLight.shadow.camera.bottom = -20;
    scene.add(sunLight);
    scene.add(sunLight.target);

    //Ground
    const ground = createGround(100, 100, new THREE.Color(0x00ff99));
    scene.add(ground); // ✅ BỎ COMMENT DÒNG NÀY

    // worldGroup (include terrain, objects)
    const worldGroup = new THREE.Group();
    scene.add(worldGroup);

    // Load map (Farm)
    let Farm = null;
    try {
        Farm = await createFarm();
        if (Farm) {
            Farm.position.set(-1, 0, -1);
            scene.add(Farm); // ✅ BỎ COMMENT DÒNG NÀY
            console.log("Farm model loaded and added to scene.");
        } else {
            console.warn("Farm model was not loaded successfully.");
        }
    } catch (error) {
        console.error("Error loading Farm model:", error);
    }

    // Car
    let carGroup = null;
    let frontWheel_L, frontWheel_R, wheel_L, wheel_R, backWheels;
    let carController = null;

    try {
        const carResult = await createCar();
        if (carResult && carResult.carGroup) {
            ({ carGroup, frontWheel_L, frontWheel_R, wheel_L, wheel_R, backWheels } = carResult);
            carGroup.position.set(0, 0, 0); // Đặt xe ở Y=10 để nó rơi xuống mặt đất
            scene.add(carGroup);
            const carAxesHelper = new THREE.AxesHelper(5);
            carGroup.add(carAxesHelper);
            console.log("Car model loaded and added to scene.");

            carController = new CarController({ carGroup, frontWheel_L, frontWheel_R, wheel_L, wheel_R, backWheels });
            cameraContrller.setTarget(carGroup);
            cameraController.setFollowMode(true);

            await carController.initAudio(listener, audioLoader);
            carController.initHeadlights();
        } else {
            console.warn("Car model was not loaded successfully.");
        }
    } catch (error) {
        console.error("Error loading Car model or setting up car/controller:", error);
    }

    // init objectManager (sau khi worldGroup đã được thêm vào scene)
    const objectManager = new ObjectManager(scene, worldGroup);

    // Tạo các hộp sử dụng ObjectManager
    objectManager.createBox1(5, 0, 5, 1, 1, new THREE.Color(0x3333ff));
    objectManager.createBox(4, 2, 8, 1, 2, new THREE.Color(0xff3333));
    objectManager.createBox(4, 2, 9, 1, 500, new THREE.Color(0xff3333));
    objectManager.createBox(4, 0, 10, 1, 1, new THREE.Color(0xffff33));
    objectManager.createCylinder(4, 1, 12, 1, 2, 12, 1, new THREE.Color(0x33ffff));

    

    


    

    function drawScene() {


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