/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as THREE from 'three';
import { initAnalytics } from './analytics.js';
import { AXES, XR_BUTTONS } from 'gamepad-wrapper';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Text } from 'troika-three-text';
import { gsap } from 'gsap';
import { init } from './init.js';

// Initialize Vercel Analytics
initAnalytics();

const bullets = {};
const forwardVector = new THREE.Vector3(0, 0, -1);
const bulletSpeed = 10;
const bulletTimeToLive = 1;

const blasterGroup = new THREE.Group();
const targets = [];

// Define Microsoft colors array
const msColors = [
	0x00A4EF, // Blue
	0x7FBA00, // Green
	0xF25022, // Red
	0xFFB900  // Yellow
];

// Define color names without "Microsoft" prefix
const colorNames = [
	"Blue",
	"Green",
	"Red",
	"Yellow"
];

// Game states
const GAME_STATE = {
	READY: 'ready',
	PLAYING: 'playing',
	GAME_OVER: 'game_over'
};

// Game timer settings
const GAME_DURATION = 60; // 60 seconds (1 minute) game duration
let gameTimer = GAME_DURATION;
let gameState = GAME_STATE.READY;
let timerRing; // Reference to the timer ring mesh
let restartSphere; // Reference to the restart sphere

let currentColorIndex = 0;
const projectileMaterial = new THREE.MeshBasicMaterial({ color: msColors[0] });

let score = 0;
const scoreText = new Text();
scoreText.fontSize = 0.05;
scoreText.font = 'assets/SpaceMono-Bold.ttf';
scoreText.anchorX = 'center';
scoreText.anchorY = 'middle';
scoreText.position.set(0, 0.2, 0.1);

// Create a bright white material that matches the blaster
const scoreTextMaterial = new THREE.MeshBasicMaterial({
	color: new THREE.Color(1, 1, 1), // Pure white using RGB values
	side: THREE.DoubleSide,
	transparent: false,
	toneMapped: false // Disable tone mapping to maintain full brightness
});

scoreText.material = scoreTextMaterial;
scoreText.color = '#FFFFFF';
scoreText.fillOpacity = 1;
scoreText.outlineWidth = 0;
scoreText.outlineOpacity = 0;
scoreText.strokeOpacity = 1;
scoreText.strokeColor = '#FFFFFF';
scoreText.renderOrder = 1;

let laserSound, scoreSound, timerEndSound;

// Create a clock for precise timing
const gameClock = new THREE.Clock();
gameClock.autoStart = false;

function updateScoreDisplay() {
	const clampedScore = Math.max(0, Math.min(99, score)); // Limit to 99
	const displayScore = clampedScore.toString().padStart(2, '0'); // Display as 2 digits
	scoreText.text = displayScore;
	scoreText.sync();
}

// Create the radial timer ring
function createTimerRing() {
	// Create a ring geometry
	const innerRadius = 0.07;
	const outerRadius = 0.09;
	const thetaSegments = 32;
	const phiSegments = 1;
	const thetaStart = 0;
	const thetaLength = Math.PI * 2; // Full circle
	
	const ringGeometry = new THREE.RingGeometry(
		innerRadius, outerRadius, thetaSegments, phiSegments, thetaStart, thetaLength
	);
	
	// Create a shader material for the timer
	const timerMaterial = new THREE.ShaderMaterial({
		uniforms: {
			color: { value: new THREE.Color(0x4CAF50) }, // Green color
			progress: { value: 1.0 } // Start at 100% (full circle)
		},
		vertexShader: `
			varying vec2 vUv;
			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
			}
		`,
		fragmentShader: `
			uniform vec3 color;
			uniform float progress;
			varying vec2 vUv;
			
			void main() {
				// Calculate angle of current fragment
				float angle = atan(vUv.y - 0.5, vUv.x - 0.5);
				
				// Normalize angle to 0-1 range
				float normalizedAngle = (angle + 3.14159) / (2.0 * 3.14159);
				
				// If normalized angle is less than progress, show color
				if (normalizedAngle > progress) {
					discard;
				}
				
				gl_FragColor = vec4(color, 1.0);
			}
		`,
		side: THREE.DoubleSide,
		transparent: true
	});
	
	// Create the ring mesh
	const ring = new THREE.Mesh(ringGeometry, timerMaterial);
	
	// Position it behind and slightly larger than the score text
	// Adjusted position to work with 0 rotation
	ring.position.set(0, 0.2, 0.1);
	
	// Set rotation to -20 degrees (converted to radians) for better visibility
	ring.rotation.x = -0.349; // -20 degrees in radians
	ring.rotation.z = -1.5; // 45 degrees in radians
	
	return ring;
}

// Update the timer display
function updateTimerDisplay(delta) {
	if (gameState !== GAME_STATE.PLAYING || !timerRing) return;
	
	// Decrease the timer
	gameTimer = Math.max(0, gameTimer - delta);
	
	// Update the shader's progress uniform
	const progress = gameTimer / GAME_DURATION;
	timerRing.material.uniforms.progress.value = progress;
	
	// Change color based on remaining time
	if (progress < 0.25) {
		// Red when < 25% time left
		timerRing.material.uniforms.color.value.set(0xFF5252);
	} else if (progress < 0.5) {
		// Orange when < 50% time left
		timerRing.material.uniforms.color.value.set(0xFFC107);
	}
	
	// Check if timer has ended
	if (gameTimer <= 0) {
		endGame();
	}
}

// End the game
function endGame() {
	gameState = GAME_STATE.GAME_OVER;
	
	// Play timer end sound
	if (timerEndSound && !timerEndSound.isPlaying) {
		timerEndSound.play();
	}
	
	// Create and show game over text
	const gameOverText = new Text();
	gameOverText.text = `Game Over`;
	gameOverText.font = 'assets/SpaceMono-Bold.ttf';
	gameOverText.fontSize = 0.15;
	gameOverText.color = 0xFF5252; // Red color
	gameOverText.anchorX = 'center';
	gameOverText.anchorY = 'middle';
	gameOverText.position.set(0, 1.8, -2); // In front of the player
	gameOverText.sync();
	
	// Create score text
	const finalScoreText = new Text();
	finalScoreText.text = `Score`;
	finalScoreText.font = 'assets/SpaceMono-Bold.ttf';
	finalScoreText.fontSize = 0.12;
	finalScoreText.color = 0x00A4EF; // Blue color
	finalScoreText.anchorX = 'center';
	finalScoreText.anchorY = 'middle';
	finalScoreText.position.set(0, 1.6, -2); // Below game over text
	finalScoreText.sync();
	
	// Create score number
	const scoreNumberText = new Text();
	scoreNumberText.text = `${score}`;
	scoreNumberText.font = 'assets/SpaceMono-Bold.ttf';
	scoreNumberText.fontSize = 0.12;
	scoreNumberText.color = 0x7FBA00; // Green color
	scoreNumberText.anchorX = 'center';
	scoreNumberText.anchorY = 'middle';
	scoreNumberText.position.set(0, 1.45, -2); // Below score text
	scoreNumberText.sync();
	
	// Create restart sphere
	const restartSphereGeometry = new THREE.SphereGeometry(0.3);
	const restartSphereMaterial = new THREE.MeshBasicMaterial({
		color: 0xFFB900 // Yellow color
	});
	restartSphere = new THREE.Mesh(restartSphereGeometry, restartSphereMaterial);
	restartSphere.position.set(0, 0.8, -2); // Lowered position below score
	
	// Create restart text
	const restartText = new Text();
	restartText.text = "Shoot To Restart";
	restartText.font = 'assets/SpaceMono-Bold.ttf';
	restartText.fontSize = 0.07;
	restartText.color = 0xFFFFFF; // Changed from blue to white
	restartText.anchorX = 'center';
	restartText.anchorY = 'middle';
	restartText.position.set(0, 0, 0.35); // Position in front of the sphere (sphere radius is 0.3)
	restartText.sync();
	restartSphere.add(restartText);
	
	// Create game over UI group
	const gameOverUI = new THREE.Group();
	gameOverUI.name = 'gameOverUI';
	gameOverUI.add(gameOverText);
	gameOverUI.add(finalScoreText);
	gameOverUI.add(scoreNumberText);
	gameOverUI.add(restartSphere);
	
	// Add to scene and track for cleanup
	if (blasterGroup.parent) {
		const scene = blasterGroup.parent.parent;
		scene.add(gameOverUI);
	}
	
	console.log("Game Over! Final Score:", score);
	
	// Hide targets
	targets.forEach(target => {
		target.visible = false;
	});
	
	// Note: No auto-restart timer anymore, player must shoot the restart sphere
}

// Prepare game but don't start the timer
function prepareGame() {
	score = 0;
	updateScoreDisplay();
	gameTimer = GAME_DURATION;
	gameState = GAME_STATE.READY;
	
	// Reset timer ring color to green
	if (timerRing) {
		timerRing.material.uniforms.color.value.set(0x4CAF50); // Reset to green
		timerRing.material.uniforms.progress.value = 1.0; // Reset to full circle
	}
	
	// Show all targets
	targets.forEach(target => {
		target.visible = true;
		target.scale.set(1, 1, 1);
	});
	
	// Remove game over UI if it exists - improved with direct scene reference
	if (restartSphere && restartSphere.parent) {
		const scene = restartSphere.parent;
		scene.remove(restartSphere);
	}
	
	// Find and remove any remaining gameOverUI by name
	if (blasterGroup.parent) {
		const scene = blasterGroup.parent.parent;
		const gameOverUI = scene.getObjectByName('gameOverUI');
		if (gameOverUI) {
			scene.remove(gameOverUI);
			console.log("Game over UI removed in prepareGame");
		}
	}
	
	// Clear restart sphere reference
	restartSphere = null;
}

// Actually start the game (timer)
function startGame() {
	gameState = GAME_STATE.PLAYING;
	gameClock.start();
	console.log("Game started!");
}

function setupScene({ scene, camera, renderer, player, controllers }) {
	const gltfLoader = new GLTFLoader();

	// Helper function to traverse model hierarchy
	function traverseModel(object, level = 0) {
		const indent = '  '.repeat(level);
		console.log(`${indent}${object.name || 'unnamed'} (${object.type})`);
		object.children.forEach(child => traverseModel(child, level + 1));
	}

	gltfLoader.load('assets/blaster.glb', (gltf) => {
		console.log('Blaster model structure:');
		traverseModel(gltf.scene);
		
		// Get references to bullet and sphere meshes
		const bulletMesh = gltf.scene.getObjectByName('bullet');
		const sphereMesh = gltf.scene.getObjectByName('sphere');
		
		// Apply shared material to both meshes
		if (bulletMesh) bulletMesh.material = projectileMaterial;
		if (sphereMesh) sphereMesh.material = projectileMaterial;
		
		blasterGroup.add(gltf.scene);
		blasterGroup.add(scoreText);
		
		// Create and add the timer ring
		timerRing = createTimerRing();
		blasterGroup.add(timerRing);
	});

	// Create sphere targets with Microsoft logo colors
	const sphereGeometry = new THREE.SphereGeometry(0.5);
	
	// Create targets that surround the player in 360 degrees
	const numTargets = 12; // Increased from 3 to 12
	const radius = 8; // Distance from center
	const heightRange = 4; // Vertical distribution range
	
	for (let i = 0; i < numTargets; i++) {
		const randomColor = msColors[Math.floor(Math.random() * msColors.length)];
		const sphereMaterial = new THREE.MeshBasicMaterial({
			color: randomColor
		});
		
		const target = new THREE.Mesh(sphereGeometry, sphereMaterial);
		
		// Calculate position in a 360-degree ring around the player
		// Use some randomness for more natural distribution
		const angle = (i / numTargets) * Math.PI * 2 + (Math.random() * 0.5);
		const horizontalRadius = radius + (Math.random() * 3 - 1.5); // Add some variety to distance
		const height = (Math.random() * heightRange) - (heightRange/2) + 1.6; // Height variety around player eye level
		
		target.position.set(
			Math.sin(angle) * horizontalRadius, // X position
			height, // Y position
			Math.cos(angle) * horizontalRadius // Z position
		);
		
		scene.add(target);
		targets.push(target);
	}

	updateScoreDisplay();

	// Load and set up positional audio
	const listener = new THREE.AudioListener();
	camera.add(listener);

	const audioLoader = new THREE.AudioLoader();
	laserSound = new THREE.PositionalAudio(listener);
	audioLoader.load('assets/laser.ogg', (buffer) => {
		laserSound.setBuffer(buffer);
		blasterGroup.add(laserSound);
	});

	scoreSound = new THREE.PositionalAudio(listener);
	audioLoader.load('assets/score.ogg', (buffer) => {
		scoreSound.setBuffer(buffer);
		scoreText.add(scoreSound);
	});
	
	// Add timer end sound - now using dedicated endGame sound
	timerEndSound = new THREE.PositionalAudio(listener);
	audioLoader.load('assets/endGame.ogg', (buffer) => {
		timerEndSound.setBuffer(buffer);
		timerEndSound.setVolume(1.5); // Slightly louder for emphasis
		blasterGroup.add(timerEndSound);
	});
	
	// Just prepare the game but don't start it yet
	prepareGame();
	
	// Listen for AR session start
	renderer.xr.addEventListener('sessionstart', () => {
		startGame(); // Start the game when AR session begins
		console.log("XR session started - game started");
	});
	
	// Listen for AR session end
	renderer.xr.addEventListener('sessionend', () => {
		// Only pause if we're in playing state
		if (gameState === GAME_STATE.PLAYING) {
			gameState = GAME_STATE.READY;
			console.log("XR session ended - game paused");
		}
	});
}

function onFrame(
	delta,
	time,
	{ scene, camera, renderer, player, controllers },
) {
	// Update the timer if game is active
	if (gameState === GAME_STATE.PLAYING) {
		updateTimerDisplay(delta);
	}
	
	if (controllers.right) {
		const { gamepad, raySpace, mesh } = controllers.right;
		
		// Initialize userData if it doesn't exist
		if (!gamepad.userData) {
			gamepad.userData = {};
		}
		
		// Check joystick input for color cycling using correct methods
		const xAxis = gamepad.getAxis(AXES.XR_STANDARD.THUMBSTICK_X);
		
		// Horizontal joystick movement detection
		if (Math.abs(xAxis) > 0.7) { // Horizontal movement threshold
			if (!gamepad.userData.colorChangeDebounce) {
				// Change color based on joystick direction
				if (xAxis > 0) {
					currentColorIndex = (currentColorIndex + 1) % msColors.length;
				} else {
					currentColorIndex = (currentColorIndex - 1 + msColors.length) % msColors.length;
				}
				
				// Update material color
				projectileMaterial.color.setHex(msColors[currentColorIndex]);
				gamepad.userData.colorChangeDebounce = true;
				
				// Update color indicator in the UI
				const colorIndicator = document.getElementById('colorIndicator');
				const colorName = document.getElementById('colorName');
				if (colorIndicator) {
					colorIndicator.style.background = '#' + msColors[currentColorIndex].toString(16).padStart(6, '0');
				}
				if (colorName) {
					colorName.textContent = colorNames[currentColorIndex];
				}
				
				// Add haptic feedback for color change
				try {
					gamepad.getHapticActuator(0).pulse(0.3, 50);
				} catch {
					// do nothing if haptic feedback not available
				}
			}
		} else {
			gamepad.userData.colorChangeDebounce = false;
		}

		if (!raySpace.children.includes(blasterGroup)) {
			raySpace.add(blasterGroup);
			mesh.visible = false;
		}
		if (gamepad.getButtonClick(XR_BUTTONS.TRIGGER)) {
			try {
				gamepad.getHapticActuator(0).pulse(0.6, 100);
			} catch {
				// do nothing
			}

			// Play laser sound
			if (laserSound.isPlaying) laserSound.stop();
			laserSound.play();

			const bulletPrototype = blasterGroup.getObjectByName('bullet');
			if (bulletPrototype) {
				const bullet = bulletPrototype.clone();
				scene.add(bullet);
				bulletPrototype.getWorldPosition(bullet.position);
				bulletPrototype.getWorldQuaternion(bullet.quaternion);

				const directionVector = forwardVector
					.clone()
					.applyQuaternion(bullet.quaternion);
				bullet.userData = {
					velocity: directionVector.multiplyScalar(bulletSpeed),
					timeToLive: bulletTimeToLive,
				};
				bullets[bullet.uuid] = bullet;
			}
		}
	}

	Object.values(bullets).forEach((bullet) => {
		if (bullet.userData.timeToLive < 0) {
			delete bullets[bullet.uuid];
			scene.remove(bullet);
			return;
		}
		const deltaVec = bullet.userData.velocity.clone().multiplyScalar(delta);
		bullet.position.add(deltaVec);
		bullet.userData.timeToLive -= delta;

		// Check for restart sphere hit in game over state
		if (gameState === GAME_STATE.GAME_OVER && restartSphere) {
			const distanceToRestartSphere = restartSphere.position.distanceTo(bullet.position);
			if (distanceToRestartSphere < 0.3) { // Sphere radius is 0.3
				// Check if bullet color matches the restart sphere color (yellow)
				const bulletColor = projectileMaterial.color.getHex();
				const restartSphereColor = 0xFFB900; // Yellow color
				
				if (bulletColor === restartSphereColor) {
					// Color match - restart the game!
					delete bullets[bullet.uuid];
					scene.remove(bullet);
					
					// Play score sound for feedback
					if (scoreSound.isPlaying) scoreSound.stop();
					scoreSound.play();
					
					// Vibration feedback
					if (controllers.right && controllers.right.gamepad) {
						try {
							controllers.right.gamepad.getHapticActuator(0).pulse(0.8, 300);
						} catch {
							// do nothing if haptic feedback not available
						}
					}
					
					// Find and remove the gameOverUI from the scene directly
					const gameOverUI = scene.getObjectByName('gameOverUI');
					if (gameOverUI) {
						scene.remove(gameOverUI);
						console.log("Game over UI removed directly");
					}
					
					prepareGame();
					startGame();
					return;
				} else {
					// Color mismatch - bullet passes through
					// Optional: Add visual feedback that wrong color was used
					console.log("Wrong color projectile used on restart sphere");
				}
			}
		}

		// Check for normal target hits during gameplay
		if (gameState === GAME_STATE.PLAYING) {
			targets
				.filter((target) => target.visible)
				.forEach((target) => {
					const distance = target.position.distanceTo(bullet.position);
					if (distance < 1) {
						// Check if bullet color matches target color
						const bulletColor = projectileMaterial.color.getHex();
						const targetColor = target.material.color.getHex();
						
						if (bulletColor === targetColor) {
							// Color match - successful hit!
							delete bullets[bullet.uuid];
							scene.remove(bullet);

							gsap.to(target.scale, {
								duration: 0.3,
								x: 0,
								y: 0,
								z: 0,
								onComplete: () => {
									target.visible = false;
									setTimeout(() => {
										target.visible = true;
										
										// Respawn in a new position around the player in 360 degrees
										const angle = Math.random() * Math.PI * 2;
										const horizontalRadius = 7 + (Math.random() * 4); // 7-11 units away
										const height = (Math.random() * 4) - 2 + 1.6; // Between -0.4 and 3.6
										
										target.position.set(
											Math.sin(angle) * horizontalRadius,
											height,
											Math.cos(angle) * horizontalRadius
										);
										
										// Assign a random color from the colors
										const randomColor = msColors[Math.floor(Math.random() * msColors.length)];
										target.material.color.setHex(randomColor);

										// Scale back up the target
										gsap.to(target.scale, {
											duration: 0.3,
											x: 1,
											y: 1,
											z: 1,
										});
									}, 1000);
								},
							});

							score += 1; // Change from 10 to 1 point per hit
							updateScoreDisplay();
							if (scoreSound.isPlaying) scoreSound.stop();
							scoreSound.play();
							
							// Optional: Add a "miss" effect or feedback here
						} else {
							// Color mismatch - bullet passes through
							// Optional: Add a "miss" effect or feedback here
						}
					}
				});
		}
	});
	gsap.ticker.tick(delta);
}

init(setupScene, onFrame);
