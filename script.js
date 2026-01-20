import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// --- Constants & Config ---
const WORLD_SIZE = 5000;
const BULLET_SPEED = 1800;
const BULLET_LIFETIME = 2500;
const PLANE_SCALE_TARGET = 20;
const STALL_SPEED = 0.3;
const LANDING_SPEED_MAX = 0.5;

// --- Scene Setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 200, 4500);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 15000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
document.getElementById('game-container').appendChild(renderer.domElement);

const debugDiv = document.getElementById('debug-info');
function debug(msg) {
    if (debugDiv) debugDiv.innerText = msg;
    console.log(msg);
}

// --- Lighting ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(1000, 2000, 1000);
sun.castShadow = true;
sun.shadow.camera.left = -2500;
sun.shadow.camera.right = 2500;
sun.shadow.camera.top = 2500;
sun.shadow.camera.bottom = -2500;
sun.shadow.camera.far = 6000;
sun.shadow.mapSize.width = 2048;
sun.shadow.mapSize.height = 2048;
scene.add(sun);

// --- Terrain & Map ---
const terrainGeometry = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, 100, 100);
terrainGeometry.rotateX(-Math.PI / 2);

const posAttr = terrainGeometry.attributes.position;
for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);
    // Base rolling hills
    let y = Math.sin(x * 0.005) * Math.cos(z * 0.005) * 30;

    // Boundary mountains (Bounded Map)
    const dist = Math.sqrt(x * x + z * z);
    if (dist > WORLD_SIZE * 0.4) {
        y += Math.pow((dist - WORLD_SIZE * 0.4) / 200, 2) * 300;
    }

    // Flatten a small area for the runway
    if (Math.abs(x) < 200 && Math.abs(z - 1500) < 400) {
        y = 1;
    }

    posAttr.setY(i, y);
}
terrainGeometry.computeVertexNormals();

const terrainMaterial = new THREE.MeshStandardMaterial({
    color: 0x3d5e3a,
    roughness: 0.9,
    metalness: 0.1
});
const terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
terrain.receiveShadow = true;
scene.add(terrain);

// --- Runway ---
const runwayGeo = new THREE.PlaneGeometry(150, 600);
const runwayMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
const runway = new THREE.Mesh(runwayGeo, runwayMat);
runway.rotation.x = -Math.PI / 2;
runway.position.set(0, 1.5, 1500);
runway.receiveShadow = true;
scene.add(runway);

// --- Clouds ---
function createClouds() {
    const cloudGroup = new THREE.Group();
    for (let i = 0; i < 80; i++) {
        const cloud = new THREE.Group();
        const numBlobs = 3 + Math.floor(Math.random() * 5);
        for (let j = 0; j < numBlobs; j++) {
            const blob = new THREE.Mesh(
                new THREE.SphereGeometry(30 + Math.random() * 40, 7, 7),
                new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 })
            );
            blob.position.set(
                (Math.random() - 0.5) * 80,
                (Math.random() - 0.5) * 30,
                (Math.random() - 0.5) * 80
            );
            cloud.add(blob);
        }
        cloud.position.set(
            (Math.random() - 0.5) * WORLD_SIZE * 1.8,
            800 + Math.random() * 1200,
            (Math.random() - 0.5) * WORLD_SIZE * 1.8
        );
        cloudGroup.add(cloud);
    }
    scene.add(cloudGroup);
}
createClouds();

// --- Objects ---
let playerPlane = null;
let npcPlane = null;
const loader = new GLTFLoader();

const playerState = {
    speed: 1.0,
    minSpeed: 0.1,
    maxSpeed: 3.5,
    health: 100,
    bullets: 1000,
    isDead: false,
    cameraMode: 'chase', // 'chase' or 'cockpit'
    objective: 'DESTROY_NPC',
    isLanded: false,
    stalling: false
};

const npcState = {
    speed: 1.2,
    health: 100,
    isDead: false,
    lastShootTime: 0,
    state: 'CHASE',
    stateTimer: 0
};

function setupPlane(plane, isPlayer) {
    const box = new THREE.Box3().setFromObject(plane);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = PLANE_SCALE_TARGET / maxDim;
    plane.scale.set(scale, scale, scale);

    plane.traverse(c => {
        if (c.isMesh) {
            c.castShadow = true;
            c.receiveShadow = true;
            if (!isPlayer) {
                c.material = c.material.clone();
                c.material.color.set(0xff4444);
            }
        }
    });
}

loader.load('fighterjet1.glb', (gltf) => {
    playerPlane = gltf.scene;
    setupPlane(playerPlane, true);
    playerPlane.position.set(0, 500, -1500);
    playerPlane.lookAt(0, 500, 0);
    scene.add(playerPlane);
    debug("Objective: Destroy the enemy fighter!");

    loader.load('fighterjet1.glb', (gltfNPC) => {
        npcPlane = gltfNPC.scene;
        setupPlane(npcPlane, false);
        npcPlane.position.set(1000, 600, 1000);
        scene.add(npcPlane);
    });
});

// --- Input & Controls ---
const keys = {};
window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'KeyC') {
        playerState.cameraMode = playerState.cameraMode === 'chase' ? 'cockpit' : 'chase';
        debug(`Camera: ${playerState.cameraMode.toUpperCase()}`);
    }
});
window.addEventListener('keyup', e => keys[e.code] = false);

let mouseX = 0, mouseY = 0;
window.addEventListener('mousemove', e => {
    mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
});

// --- Particles & FX ---
const particles = [];
function createExplosion(pos) {
    for (let i = 0; i < 60; i++) {
        const p = new THREE.Mesh(
            new THREE.SphereGeometry(3, 4, 4),
            new THREE.MeshBasicMaterial({ color: Math.random() > 0.5 ? 0xff4400 : 0xffaa00 })
        );
        p.position.copy(pos);
        const vel = new THREE.Vector3(
            (Math.random() - 0.5) * 150,
            (Math.random() - 0.5) * 150,
            (Math.random() - 0.5) * 150
        );
        particles.push({ mesh: p, vel, life: 1.5 });
        scene.add(p);
    }
}

// --- Combat ---
const bullets = [];
function shoot(source, owner) {
    if (owner === 'player') {
        if (playerState.bullets <= 0) return;
        playerState.bullets -= 1;
        const ammoDisp = document.getElementById('ammo-display');
        if (ammoDisp) ammoDisp.innerText = `Ammo: ${playerState.bullets}`;
    }

    const bullet = new THREE.Mesh(
        new THREE.SphereGeometry(1.5, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffff44 })
    );
    const offset = new THREE.Vector3(0, 0, 20).applyQuaternion(source.quaternion);
    bullet.position.copy(source.position).add(offset);

    const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(source.quaternion);
    bullet.userData = {
        velocity: dir.multiplyScalar(BULLET_SPEED),
        owner,
        birth: Date.now()
    };
    scene.add(bullet);
    bullets.push(bullet);
}

window.addEventListener('mousedown', () => {
    if (playerPlane && !playerState.isDead && !playerState.isLanded) shoot(playerPlane, 'player');
});

// --- Updates ---
function update(delta) {
    if (playerPlane && !playerState.isDead && !playerState.isLanded) {
        const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(playerPlane.quaternion);

        // --- Complex Physics ---
        // Gravity effect: Climbing slows down, diving speeds up
        playerState.speed -= forward.y * 0.4 * delta;

        // Throttle
        if (keys['KeyW'] || keys['ArrowUp']) playerState.speed += 0.5 * delta;
        if (keys['KeyS'] || keys['ArrowDown']) playerState.speed -= 0.5 * delta;

        // Boost
        let currentMax = playerState.maxSpeed;
        if (keys['ShiftLeft'] || keys['ShiftRight']) {
            playerState.speed += 0.8 * delta;
            currentMax = playerState.maxSpeed * 1.5;
        }

        // Air Resistance (Drag) - proportional to square of speed
        const drag = 0.15 * playerState.speed * Math.abs(playerState.speed) * delta;
        playerState.speed -= drag;

        // Stall logic
        if (playerState.speed < STALL_SPEED) {
            playerState.stalling = true;
            playerPlane.rotateX(-0.5 * delta); // Nose drops
            if (Date.now() % 1000 < 500) debug("!!! STALLING !!!");
        } else {
            playerState.stalling = false;
            if (playerState.objective === 'LAND') {
                const dist = playerPlane.position.distanceTo(runway.position);
                if (Date.now() % 2000 < 1000) debug(`Runway: ${Math.round(dist)}m ahead`);
            }
        }

        playerState.speed = Math.max(0, Math.min(playerState.speed, currentMax));

        // Maneuvering
        const rollSpeed = 1.5 * delta;
        if (keys['KeyA'] || keys['ArrowLeft']) playerPlane.rotateZ(rollSpeed);
        if (keys['KeyD'] || keys['ArrowRight']) playerPlane.rotateZ(-rollSpeed);

        const pitchSpeed = 1.2 * delta;
        const yawSpeed = 0.8 * delta;
        playerPlane.rotateX(mouseY * pitchSpeed);
        playerPlane.rotateY(-mouseX * yawSpeed);

        // Move forward
        playerPlane.translateZ(playerState.speed * 200 * delta);

        // Ground Collision
        const ray = new THREE.Raycaster(playerPlane.position, new THREE.Vector3(0, -1, 0));
        const hits = ray.intersectObject(terrain);
        const terrainHeight = hits.length > 0 ? hits[0].point.y : -100;

        if (playerPlane.position.y < terrainHeight + 4) {
            // Check for landing
            const distToRunway = playerPlane.position.distanceTo(runway.position);
            const verticalVel = forward.y * playerState.speed;

            if (playerState.objective === 'LAND' && distToRunway < 300 && playerState.speed < LANDING_SPEED_MAX && Math.abs(verticalVel) < 0.1) {
                playerState.isLanded = true;
                playerPlane.position.y = 5;
                onGameOver("MISSION ACCOMPLISHED!");
            } else {
                playerState.health = 0;
                onGameOver("CRASHED!");
            }
        }

        // Boundary check
        if (playerPlane.position.length() > WORLD_SIZE * 0.48) {
            playerPlane.translateZ(-playerState.speed * 200 * delta); // Push back
        }

        // HUD Update
        const speedDisp = document.getElementById('speed-display');
        if (speedDisp) speedDisp.innerText = `Speed: ${Math.round(playerState.speed * 180)} mph`;
        const altDisp = document.getElementById('altitude-display');
        if (altDisp) altDisp.innerText = `Altitude: ${Math.round(playerPlane.position.y * 5)} ft`;
        const healthFill = document.getElementById('health-fill');
        if (healthFill) healthFill.style.width = `${playerState.health}%`;

        // Camera Update
        let idealOffset;
        let lookAtTarget;
        if (playerState.cameraMode === 'chase') {
            idealOffset = new THREE.Vector3(0, 15, -60).applyQuaternion(playerPlane.quaternion).add(playerPlane.position);
            camera.position.lerp(idealOffset, 0.1);
            lookAtTarget = new THREE.Vector3(0, 0, 100).applyQuaternion(playerPlane.quaternion).add(playerPlane.position);
            camera.lookAt(lookAtTarget);
        } else {
            // Cockpit
            idealOffset = new THREE.Vector3(0, 2.8, 6).applyQuaternion(playerPlane.quaternion).add(playerPlane.position);
            camera.position.copy(idealOffset);
            lookAtTarget = new THREE.Vector3(0, 2.5, 100).applyQuaternion(playerPlane.quaternion).add(playerPlane.position);
            camera.lookAt(lookAtTarget);
        }
    }

    // NPC Logic
    if (npcPlane && !npcState.isDead && playerPlane) {
        const dist = npcPlane.position.distanceTo(playerPlane.position);
        npcState.stateTimer -= delta;

        if (npcState.stateTimer <= 0) {
            npcState.state = (dist < 400) ? 'EVADE' : 'CHASE';
            npcState.stateTimer = 1.5 + Math.random() * 2;
        }

        let targetPos = playerPlane.position.clone();
        if (npcState.state === 'EVADE') {
            const away = new THREE.Vector3().subVectors(npcPlane.position, playerPlane.position).normalize();
            targetPos.add(away.multiplyScalar(800));
        }

        const lookMat = new THREE.Matrix4().lookAt(npcPlane.position, targetPos, new THREE.Vector3(0, 1, 0));
        const targetQuat = new THREE.Quaternion().setFromRotationMatrix(lookMat);

        // Banking
        const currentForward = new THREE.Vector3(0, 0, 1).applyQuaternion(npcPlane.quaternion);
        const desiredDir = new THREE.Vector3().subVectors(targetPos, npcPlane.position).normalize();
        const cross = new THREE.Vector3().crossVectors(currentForward, desiredDir);
        const rollAmount = THREE.MathUtils.clamp(cross.y * 12, -1.3, 1.3);
        const rollQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -rollAmount);

        npcPlane.quaternion.slerp(targetQuat.multiply(rollQuat), 0.04);

        // NPC Physics: Gravity effect
        const npcForward = new THREE.Vector3(0, 0, 1).applyQuaternion(npcPlane.quaternion);
        npcState.speed -= npcForward.y * 0.3 * delta;
        npcState.speed = THREE.MathUtils.clamp(npcState.speed, 0.6, 2.0);

        npcPlane.translateZ(npcState.speed * 160 * delta);

        if (dist < 1200 && Date.now() - npcState.lastShootTime > 800) {
            shoot(npcPlane, 'npc');
            npcState.lastShootTime = Date.now();
        }

        // NPC terrain avoidance
        const npcRay = new THREE.Raycaster(npcPlane.position, new THREE.Vector3(0, -1, 0));
        const npcHits = npcRay.intersectObject(terrain);
        const npcHeight = npcHits.length > 0 ? npcHits[0].point.y : 0;
        if (npcPlane.position.y < npcHeight + 80) {
            npcPlane.rotateX(0.06);
        }
    }

    // Bullet updates
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.position.add(b.userData.velocity.clone().multiplyScalar(delta));
        if (Date.now() - b.userData.birth > BULLET_LIFETIME) {
            scene.remove(b);
            bullets.splice(i, 1);
            continue;
        }

        if (b.userData.owner === 'player' && npcPlane && !npcState.isDead) {
            if (b.position.distanceTo(npcPlane.position) < 35) {
                npcState.health -= 20;
                scene.remove(b);
                bullets.splice(i, 1);
                if (npcState.health <= 0) {
                    npcState.isDead = true;
                    createExplosion(npcPlane.position);
                    scene.remove(npcPlane);
                    playerState.objective = 'LAND';
                    const objDisp = document.getElementById('objective-display');
                    if (objDisp) objDisp.innerText = "Obj: Return to Base & Land";
                    debug("ENEMY DESTROYED! RETURN TO BASE AND LAND.");
                }
                continue;
            }
        } else if (b.userData.owner === 'npc' && playerPlane && !playerState.isDead) {
            if (b.position.distanceTo(playerPlane.position) < 30) {
                playerState.health -= 10;
                scene.remove(b);
                bullets.splice(i, 1);
                if (playerState.health <= 0) {
                    playerState.health = 0;
                    createExplosion(playerPlane.position);
                    onGameOver("SHOT DOWN!");
                }
                continue;
            }
        }
    }

    // Particle updates
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.mesh.position.add(p.vel.clone().multiplyScalar(delta));
        p.life -= delta;
        p.mesh.scale.setScalar(p.life);
        if (p.life <= 0) {
            scene.remove(p.mesh);
            particles.splice(i, 1);
        }
    }
}

function onGameOver(text) {
    if (text !== "MISSION ACCOMPLISHED!") playerState.isDead = true;
    const msgText = document.getElementById('message-text');
    if (msgText) msgText.innerText = text;
    const msgOverlay = document.getElementById('message-overlay');
    if (msgOverlay) msgOverlay.classList.remove('hidden');
}

const restartBtn = document.getElementById('restart-btn');
if (restartBtn) restartBtn.onclick = () => location.reload();

let lastTime = 0;
function animate(time) {
    requestAnimationFrame(animate);
    const delta = Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;
    update(delta);
    renderer.render(scene, camera);
}
requestAnimationFrame(animate);

window.onresize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
};
