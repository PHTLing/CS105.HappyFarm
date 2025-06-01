// scene.js
import * as THREE from 'three';
import { createCamera } from './camera.js';
import { CarController } from './controller.js';
import { createCar, createFarm, createGround } from './objects.js'; 
import { setMass, drawBoundingBox } from './feature.js'; // Import drawBoundingBox
import { ObjectManager } from './objects.js';
import { PhysicsManager } from './physics.js'; 

export async function createScene() {
    const gameWindow = document.getElementById('render-target');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000); // Sửa màu nền cho đúng

    const cameraController = createCamera(gameWindow);
    const camera = cameraController.camera;
    camera.position.set(10, 10, 10);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true }); 
    renderer.setSize(gameWindow.clientWidth, gameWindow.clientHeight);
    renderer.shadowMap.enabled = true; 
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
    gameWindow.appendChild(renderer.domElement);

    const listener = new THREE.AudioListener();
    camera.add(listener);
    const audioLoader = new THREE.AudioLoader();

    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(5, 10, 5);
    scene.add(light);

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

    // --- Khởi tạo PhysicsManager ---
    const physicsManager = new PhysicsManager(scene); // Truyền scene để drawBoundingBox có thể hoạt động

    // Plane (Ground) - Add to PhysicsManager
    const ground = createGround(100, 100, new THREE.Color(0x00ff99));
    scene.add(ground);
    physicsManager.addBody(ground); // Thêm ground vào physics world
    // drawBoundingBox(ground, scene, 0x0000ff); // Vẽ debug BBox cho ground

    // Load map - Add to PhysicsManager if it's a static obstacle
    const Farm = await createFarm(); 
    scene.add(Farm); 
    // Cho Farm, bạn có thể cân nhắc sử dụng một Plane lớn cho vật lý thay vì Trimesh phức tạp
    // nếu địa hình tương đối phẳng và không yêu cầu va chạm chi tiết.
    // Nếu bạn muốn vật lý tương tác với địa hình chi tiết, Trimesh là cần thiết
    // nhưng việc tạo Trimesh từ GLTF geometry là phức tạp.
    // Tạm thời, Farm sẽ không có physics body nếu nó là 'Trimesh' (như trong objects.js bạn gửi)
    // vì PhysicsManager của bạn chưa hỗ trợ đầy đủ việc trích xuất geometry cho Trimesh.
    // Nếu bạn muốn Farm có vật lý, hãy đơn giản hóa nó thành một Box lớn hoặc Plane.
    // physicsManager.addBody(Farm); // HÃY THẬN TRỌNG KHI BỎ COMMENT DÒNG NÀY VỚI Farm là Trimesh

    // Car - Add to PhysicsManager
    const { carGroup, frontWheel_L, frontWheel_R, wheel_L, wheel_R, backWheels } = await createCar(); 
    scene.add(carGroup); 
    physicsManager.addBody(carGroup); // Thêm xe vào physics world
    drawBoundingBox(carGroup, scene, 0xff0000); // Vẽ debug BBox màu đỏ cho xe
    
    // Cập nhật CarController để sử dụng Cannon.Body thay vì tự điều chỉnh vị trí
    // CarController cần truy cập Cannon.Body của xe
    const carController = new CarController({ carGroup, frontWheel_L, frontWheel_R, wheel_L, wheel_R, backWheels }); 
    // Gán Cannon.Body của xe vào CarController để nó có thể áp dụng lực
    carController.setCarBody(carGroup.userData.cannonBody); // Dòng này giờ sẽ hoạt động!
    
    cameraController.setTarget(carGroup); 
    cameraController.setFollowMode(true);

    await carController.initAudio(listener, audioLoader); 
    carController.initHeadlights();

    // worldGroup (include terrain, objects)
    const worldGroup = new THREE.Group();
    scene.add(worldGroup);

    const objectManager = new ObjectManager(scene, worldGroup);

    // Tạo và thêm các hộp/trụ vào PhysicsManager
    const box1 = objectManager.createBox1(5, 0, -5, 1, 10, new THREE.Color(0x3333ff)); 
    physicsManager.addBody(box1);
    drawBoundingBox(box1, scene, 0x00ff00); // Debug BBox

    const box2 = objectManager.createBox(4, 2, -3, 1, 2, new THREE.Color(0xff3333)); 
    physicsManager.addBody(box2);
    drawBoundingBox(box2, scene, 0x00ff00); // Debug BBox

    const box3 = objectManager.createBox(4, 2, -2, 1, 500, new THREE.Color(0xff3333)); 
    physicsManager.addBody(box3);
    drawBoundingBox(box3, scene, 0x00ff00); // Debug BBox

    // Ví dụ tạo nhiều hộp, thêm vào physics
    [
        objectManager.createBox(4, 0, 0, 1, 1, new THREE.Color(0xffff33)), 
        objectManager.createBox(4, 2, 0, 1, 1, new THREE.Color(0xffff33)), 
        objectManager.createBox(4, 4, 0, 1, 1, new THREE.Color(0xffff33)), 
        objectManager.createBox(4, 6, 0, 1, 1, new THREE.Color(0xffff33)), 
        objectManager.createBox(4, 0, 2, 1, 1, new THREE.Color(0xff33ff)), 
        objectManager.createBox(4, 2 , 2, 1, 1, new THREE.Color(0xff33ff)), 
        objectManager.createBox(4, 4, 2, 1, 1, new THREE.Color(0xff33ff)), 
        objectManager.createBox(4, 6 , 2, 1, 1, new THREE.Color(0xff33ff))
    ].forEach(box => {
        physicsManager.addBody(box);
        drawBoundingBox(box, scene, 0x00ff00); // Debug BBox cho từng hộp
    });

    const cylinder1 = objectManager.createCylinder(4, 0, 4, 1, 2, 12, 1, new THREE.Color(0x33ffff)); 
    physicsManager.addBody(cylinder1);
    drawBoundingBox(cylinder1, scene, 0x00ff00); // Debug BBox
    
    // Bạn có thể thêm các listeners va chạm ở đây nếu cần
    // physicsManager.addCollisionListener(carGroup.userData.cannonBody, box1.userData.cannonBody, (event) => {
    //     console.log('Car collided with box1!');
    // });

    const keyState = {}

    window.addEventListener('keydown', (e) => {
        keyState[e.key.toLowerCase()] = true;
    });
    window.addEventListener('keyup', (e) => {
        keyState[e.key.toLowerCase()] = false;
    });

    // Biến để tính toán deltaTime
    let lastTime = performance.now();

    function update() {
        const currentTime = performance.now();
        const deltaTime = (currentTime - lastTime) / 1000; // Chuyển đổi sang giây
        lastTime = currentTime;

        carController.update(keyState, deltaTime); // Truyền deltaTime vào CarController

        physicsManager.update(deltaTime); // Cập nhật physics world

        const lightYOffset = 15; 
        const lightXOffset = -10; 
        const lightZOffset = 10; 
        sunLight.position.copy(carGroup.position);
        sunLight.position.y += lightYOffset;
        sunLight.position.x += lightXOffset;
        sunLight.position.z += lightZOffset;
        
        sunLight.target.position.copy(carGroup.position);
        sunLight.target.updateMatrixWorld(); 
    }

    function updateCamera() {
        // Cần điều chỉnh logic camera để nó theo sau carGroup.position (đã được physics update)
        // Thay vì tính toán phức tạp, bạn có thể dùng cameraController.setTarget và setFollowMode
        // như đã có, đảm bảo cameraController.update được gọi.
        cameraController.updateCameraPosition(); 
    }

    function drawScene() {
        update();
        updateCamera(); // Camera cũng cần được update mỗi frame
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