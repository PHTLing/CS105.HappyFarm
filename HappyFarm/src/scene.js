import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createCamera } from './camera';
import { createCar, CarController } from './car';

export async function createScene() {
    // Initial scene setup
    const gameWindow = document.getElementById('render-target');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x770077);

    // Camera
    const cameraController = createCamera(gameWindow);
    const camera = cameraController.camera;
    camera.position.set(10, 10, 10);
    camera.lookAt(0, 0, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(gameWindow.clientWidth, gameWindow.clientHeight);
    gameWindow.appendChild(renderer.domElement);

    // Car
    const car = await createCar();  // đợi load xong
    scene.add(car);
    
    // Camera follow car
    const carController = new CarController(car);
    cameraController.setTarget(car);
    cameraController.setFollowMode(true);

    // Group toàn cảnh (có thể bao gồm terrain, object khác)
    const worldGroup = new THREE.Group();
    scene.add(worldGroup);

    // //Plane
    // const ground = new THREE.Mesh(
    //     new THREE.PlaneGeometry(100, 100),
    //     new THREE.MeshBasicMaterial({ color: 0xffff00 })
    //   );
    // ground.rotation.x = -0.5*Math.PI;
    // scene.add(ground);

    
    // Load map
    const loader = new GLTFLoader();
    const mapURL = '/assets/farm.glb';

    loader.load(mapURL, (gltf) => {
        const map = gltf.scene;
        map.rotateY(Math.PI / 2); // Xoay mô hình nếu cần
        scene.add(map);
    }, undefined, (error) => {
        console.error('Error loading map:', error);
    });
      
     // Thêm 1 số object vào cảnh
    const box = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({ color: 0x3333ff })
    );
    box.position.set(5, 0.5, 5);
    worldGroup.add(box);

    // Lighting
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(5, 10, 5);
    scene.add(light);

    //sun light
    const sunLight = new THREE.DirectionalLight(0xffffff, 1);
    sunLight.position.set(0, 10, 0);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 50;
    sunLight.shadow.camera.left = -10;
    sunLight.shadow.camera.right = 10;
    sunLight.shadow.camera.top = 10;
    sunLight.shadow.camera.bottom = -10;
    scene.add(sunLight);


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
    }

    function updateCamera() {
        // cameraController.updateCameraPosition();
        const camHeight = 10;
        const camDistance = 20;
        const cameraOffset = new THREE.Vector3(0, camHeight, camDistance);
        const desiredPosition = new THREE.Vector3().copy(car.position).add(cameraOffset);

        camera.position.lerp(desiredPosition, 0.1);
        camera.lookAt(car.position);
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
