import * as THREE from 'three';
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

    //Plane
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(100, 100),
        new THREE.MeshBasicMaterial({ color: 0xffff00 })
      );
    ground.rotation.x = -0.5*Math.PI;
    scene.add(ground);
      
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
        const camHeight = 40;
        const camDistance = 40;
        const cameraOffset = new THREE.Vector3(0, camHeight, camDistance);
        const desiredPosition = new THREE.Vector3().copy(car.position).add(cameraOffset);

        camera.position.lerp(desiredPosition, 0.1);
        camera.lookAt(car.position);
    }


    function drawScene() {
        update();
        updateCamera();
        cameraController.updateCameraPosition();
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
