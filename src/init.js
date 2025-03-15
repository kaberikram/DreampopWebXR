/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as THREE from 'three';

import { XRDevice, metaQuest3 } from 'iwer';

import { DevUI } from '@iwer/devui';
import { GamepadWrapper } from 'gamepad-wrapper';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

// Custom AR button class for passthrough mode - enhanced version
class ARButton {
	static createButton(renderer) {
		const button = document.createElement('button');
		button.id = 'arButton';
		button.style.display = 'none';
		
		// Check if AR is supported
		if (navigator.xr) {
			navigator.xr.isSessionSupported('immersive-ar')
				.then((supported) => {
					if (supported) {
						// Show button
						button.style.display = 'block';
						button.style.position = 'absolute';
						button.style.left = '50%';
						button.style.transform = 'translateX(-50%)';
						button.style.zIndex = '999';
						button.textContent = 'START AR EXPERIENCE';
						
						// Hover effects
						button.onmouseenter = () => {
							button.style.background = 'rgba(41, 128, 185, 0.9)'; // Deeper blue on hover
							button.style.transform = 'translateX(-50%) scale(1.05)';
							button.style.boxShadow = '0 6px 12px rgba(0, 0, 0, 0.3)';
						};
						
						button.onmouseleave = () => {
							button.style.background = 'rgba(70, 130, 180, 0.8)';
							button.style.transform = 'translateX(-50%) scale(1)';
							button.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
						};
						
						// Session management
						let currentSession = null;
						
						const onSessionEnded = () => {
							currentSession = null;
							button.textContent = 'START AR EXPERIENCE';
							// Show the title and instructions again when exiting AR
							const arTitle = document.getElementById('arTitle');
							const arInstructions = document.getElementById('arInstructions');
							
							if (arTitle) {
								arTitle.style.display = 'block';
							}
							
							if (arInstructions) {
								arInstructions.style.display = 'block';
							}
							
							console.log('AR session ended');
						};
						
						button.onclick = () => {
							if (currentSession === null) {
								// Configuration for AR session
								const sessionInit = {
									optionalFeatures: [
										'dom-overlay',
										'hit-test',
										'anchors',
										'plane-detection',
										'local',
										'local-floor',
										'bounded-floor',
										'viewer'
									],
									domOverlay: { root: document.body }
								};
								
								// Hide the title and instructions when entering AR
								if (document.getElementById('arTitle')) {
									document.getElementById('arTitle').style.display = 'none';
								}
								if (document.getElementById('arInstructions')) {
									document.getElementById('arInstructions').style.display = 'none';
								}
								
								// Start session
								console.log('Requesting AR session');
								navigator.xr.requestSession('immersive-ar', sessionInit)
									.then((session) => {
										currentSession = session;
										session.addEventListener('end', onSessionEnded);
										button.textContent = 'EXIT AR';
										
										// Set session in renderer
										try {
											renderer.xr.setSession(session);
											console.log('AR session started successfully');
										} catch (err) {
											console.error('Error setting up AR session:', err);
											session.end();
											alert('Error setting up AR: ' + err.message);
										}
									})
									.catch((error) => {
										console.error('Error requesting AR session:', error);
										alert('Failed to start AR: ' + error.message);
									});
							} else {
								// End session if one exists
								currentSession.end();
								// onSessionEnded will be called via the event listener
							}
						};
						
						// Clean up when page visibility changes
						document.addEventListener('visibilitychange', () => {
							if (document.hidden && currentSession) {
								console.log('Page hidden, ending AR session');
								currentSession.end();
							}
						});
					} else {
						// AR not supported - show a more helpful message
						button.style.display = 'block';
						button.style.position = 'absolute';
						button.style.bottom = '20px';
						button.style.left = '50%';
						button.style.transform = 'translateX(-50%)';
						button.style.padding = '16px 20px';
						button.style.background = 'rgba(231, 76, 60, 0.8)'; // Red with transparency
						button.style.color = 'white';
						button.style.fontWeight = 'bold';
						button.style.fontSize = '16px';
						button.style.border = 'none';
						button.style.borderRadius = '8px';
						button.style.cursor = 'not-allowed';
						button.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
						button.textContent = 'AR NOT SUPPORTED ON THIS DEVICE';
						
						// Add explanation text
						const explanation = document.createElement('div');
						explanation.style.position = 'absolute';
						explanation.style.bottom = '80px';
						explanation.style.width = '100%';
						explanation.style.textAlign = 'center';
						explanation.style.color = 'white';
						explanation.style.padding = '10px';
						explanation.style.background = 'rgba(0, 0, 0, 0.5)';
						explanation.innerHTML = 'This experience requires a Meta Quest headset<br>with passthrough AR capability.';
						document.body.appendChild(explanation);
					}
				})
				.catch((error) => {
					console.error('Error checking AR support:', error);
					button.style.display = 'none';
				});
		} else {
			// WebXR not supported at all
			const message = document.createElement('div');
			message.style.position = 'absolute';
			message.style.top = '50%';
			message.style.width = '100%';
			message.style.textAlign = 'center';
			message.style.color = 'white';
			message.style.background = 'rgba(0, 0, 0, 0.7)';
			message.style.padding = '20px';
			message.style.fontSize = '18px';
			message.innerHTML = 'Your browser does not support WebXR.<br>Please try a compatible browser like Oculus Browser.';
			document.body.appendChild(message);
		}
		
		return button;
	}
}

export async function init(setupScene = () => {}, onFrame = () => {}) {
	// iwer setup
	let nativeWebXRSupport = false;
	if (navigator.xr) {
		nativeWebXRSupport = await navigator.xr.isSessionSupported('immersive-ar');
	}
	if (!nativeWebXRSupport) {
		const xrDevice = new XRDevice(metaQuest3);
		xrDevice.installRuntime();
		xrDevice.fovy = (75 / 180) * Math.PI;
		xrDevice.ipd = 0;
		window.xrdevice = xrDevice;
		xrDevice.controllers.right.position.set(0.15649, 1.43474, -0.38368);
		xrDevice.controllers.right.quaternion.set(
			0.14766305685043335,
			0.02471366710960865,
			-0.0037767395842820406,
			0.9887216687202454,
		);
		xrDevice.controllers.left.position.set(-0.15649, 1.43474, -0.38368);
		xrDevice.controllers.left.quaternion.set(
			0.14766305685043335,
			0.02471366710960865,
			-0.0037767395842820406,
			0.9887216687202454,
		);
		new DevUI(xrDevice);
	}

	const container = document.createElement('div');
	document.body.appendChild(container);

	const scene = new THREE.Scene();
	// Change background to black (instead of white) for non-XR mode
	scene.background = new THREE.Color(0x000000);

	const camera = new THREE.PerspectiveCamera(
		50,
		window.innerWidth / window.innerHeight,
		0.1,
		100,
	);
	camera.position.set(0, 1.6, 3);

	const controls = new OrbitControls(camera, container);
	controls.target.set(0, 1.6, 0);
	controls.update();

	// Enable alpha (transparency) for AR passthrough
	const renderer = new THREE.WebGLRenderer({ 
		antialias: true,
		alpha: true,
		premultipliedAlpha: false,
		preserveDrawingBuffer: true
	});
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.xr.enabled = true;

	// Add a custom handler for getting reference spaces
	const originalSetSession = renderer.xr.setSession.bind(renderer.xr);
	renderer.xr.setSession = async function(session) {
		console.log('Custom session handler setting up session:', session.mode);
		try {
			// Let Three.js try to set up the session and reference spaces
			await originalSetSession(session);
			console.log('Three.js session setup complete');
		} catch (error) {
			console.error('Error in Three.js session setup:', error);
			if (error.message && error.message.includes('reference space')) {
				console.log('Trying alternative reference spaces...');
				
				// Try different reference spaces in sequence
				const refSpaceTypes = ['bounded-floor', 'local-floor', 'local', 'viewer', 'unbounded'];
				
				for (const type of refSpaceTypes) {
					try {
						console.log(`Trying alternative reference space: ${type}`);
						const referenceSpace = await session.requestReferenceSpace(type);
						renderer.xr.setReferenceSpace(referenceSpace);
						console.log(`Successfully set alternative reference space: ${type}`);
						return;
					} catch (e) {
						console.warn(`Failed to get reference space ${type}:`, e);
					}
				}
				
				alert('Unable to establish any reference space. AR may not work properly.');
			} else {
				// Re-throw other errors
				throw error;
			}
		}
	};

	// Set output encoding for better rendering in AR
	renderer.outputColorSpace = THREE.SRGBColorSpace;

	// Use tone mapping for better lighting in AR
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	container.appendChild(renderer.domElement);

	const environment = new RoomEnvironment(renderer);
	const pmremGenerator = new THREE.PMREMGenerator(renderer);
	scene.environment = pmremGenerator.fromScene(environment).texture;

	const player = new THREE.Group();
	scene.add(player);
	player.add(camera);

	const controllerModelFactory = new XRControllerModelFactory();
	const controllers = {
		left: null,
		right: null,
	};
	for (let i = 0; i < 2; i++) {
		const raySpace = renderer.xr.getController(i);
		const gripSpace = renderer.xr.getControllerGrip(i);
		const mesh = controllerModelFactory.createControllerModel(gripSpace);
		gripSpace.add(mesh);
		player.add(raySpace, gripSpace);
		raySpace.visible = false;
		gripSpace.visible = false;
		gripSpace.addEventListener('connected', (e) => {
			raySpace.visible = true;
			gripSpace.visible = true;
			const handedness = e.data.handedness;
			controllers[handedness] = {
				raySpace,
				gripSpace,
				mesh,
				gamepad: new GamepadWrapper(e.data.gamepad),
			};
		});
		gripSpace.addEventListener('disconnected', (e) => {
			raySpace.visible = false;
			gripSpace.visible = false;
			const handedness = e.data.handedness;
			controllers[handedness] = null;
		});
	}

	function onWindowResize() {
		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();

		renderer.setSize(window.innerWidth, window.innerHeight);
	}

	window.addEventListener('resize', onWindowResize);

	const globals = {
		scene,
		camera,
		renderer,
		player,
		controllers,
	};

	setupScene(globals);

	const clock = new THREE.Clock();
	function animate() {
		const delta = clock.getDelta();
		const time = clock.getElapsedTime();
		Object.values(controllers).forEach((controller) => {
			if (controller?.gamepad) {
				controller.gamepad.update();
			}
		});
		onFrame(delta, time, globals);
		
		// Simplified session check focused only on AR mode
		if (renderer.xr.isPresenting) {
			const session = renderer.xr.getSession();
			// When in AR mode, make scene background transparent
			if (session.mode === 'immersive-ar') {
				scene.background = null;
				renderer.setClearColor(0x000000, 0); // Transparent background
				scene.fog = null; // Disable fog in AR mode
			}
		} else {
			// When not in AR, use black background
			scene.background = new THREE.Color(0x000000);
		}
		
		renderer.render(scene, camera);
	}

	renderer.setAnimationLoop(animate);

	// Remove any existing copyright or informational elements that might be in the HTML
	document.querySelectorAll('footer, header, .copyright, .info, .meta').forEach(el => {
		if (el) el.style.display = 'none';
	});

	// Find and remove any text nodes in the body that contain copyright information
	const textNodes = [...document.body.childNodes].filter(node => 
		node.nodeType === Node.TEXT_NODE || 
		(node.nodeType === Node.ELEMENT_NODE && 
		 (node.tagName === 'DIV' || node.tagName === 'P' || node.tagName === 'SPAN') &&
		 !node.id));

	textNodes.forEach(node => {
		const content = node.textContent || node.innerText || '';
		if (content.includes('Copyright') || 
			content.includes('MIT License') || 
			content.includes('Meta Platforms') ||
			content.includes('GitHub') ||
			content.includes('Terms') ||
			content.includes('Privacy') ||
			content.includes('Tutorial')) {
			if (node.parentNode) {
				node.parentNode.removeChild(node);
			}
		}
	});

	// Add start button with AR functionality
	const startButton = document.createElement('button');
	startButton.textContent = 'Start';
	startButton.style.fontSize = '1.4rem';
	startButton.style.padding = '0.8rem 4rem';
	startButton.style.border = '2px solid white';
	startButton.style.borderRadius = '8px';
	startButton.style.background = 'transparent';
	startButton.style.color = 'white';
	startButton.style.cursor = 'pointer';
	startButton.style.transition = 'all 0.3s ease';
	startButton.style.marginBottom = '1rem';
	startButton.style.fontWeight = 'bold';
	startButton.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';

	// Add hover effects for start button
	startButton.onmouseenter = () => {
		startButton.style.background = 'white';
		startButton.style.color = 'black';
	};
	startButton.onmouseleave = () => {
		startButton.style.background = 'transparent';
		startButton.style.color = 'white';
	};

	// Add AR functionality to start button
	let currentSession = null;
	startButton.addEventListener('click', async () => {
		if (currentSession === null) {
			// Configuration for AR session
			const sessionInit = {
				optionalFeatures: [
					'dom-overlay',
					'hit-test',
					'anchors',
					'plane-detection',
					'local',
					'local-floor',
					'bounded-floor',
					'viewer'
				],
				domOverlay: { root: document.body }
			};

			try {
				// Request AR session
				const session = await navigator.xr.requestSession('immersive-ar', sessionInit);
				await renderer.xr.setSession(session);
				currentSession = session;
				
				// Hide the title card when entering AR
				titleCard.style.display = 'none';

				session.addEventListener('end', () => {
					currentSession = null;
					titleCard.style.display = 'flex';
					console.log('AR session ended');
				});

			} catch (error) {
				console.error('Error starting AR session:', error);
				alert('Failed to start AR: ' + error.message);
			}
		} else {
			// End session if one exists
			await currentSession.end();
		}
	});

	// Add title card
	const titleCard = document.createElement('div');
	titleCard.id = 'titleCard';
	titleCard.style.position = 'absolute';
	titleCard.style.top = '50%';
	titleCard.style.left = '50%';
	titleCard.style.transform = 'translate(-50%, -50%)';
	titleCard.style.textAlign = 'center';
	titleCard.style.color = 'white';
	titleCard.style.padding = '2rem';
	titleCard.style.borderRadius = '24px';
	titleCard.style.background = 'rgba(0, 0, 0, 0.9)';
	titleCard.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.3)';
	titleCard.style.width = '500px';
	titleCard.style.height = '500px';
	titleCard.style.border = '2px solid rgba(255, 255, 255, 0.8)';
	titleCard.style.display = 'flex';
	titleCard.style.flexDirection = 'column';
	titleCard.style.justifyContent = 'space-between';
	titleCard.style.alignItems = 'center';

	// Add title image
	const titleImage = document.createElement('img');
	titleImage.src = 'assets/dreampopWeb.png';
	titleImage.alt = 'Dreampop';
	titleImage.style.width = 'auto';
	titleImage.style.height = '120px';
	titleImage.style.display = 'block';

	// Add game instructions
	const gameInstructions = document.createElement('div');
	gameInstructions.style.fontSize = '1.1rem';
	gameInstructions.style.lineHeight = '0.3';
	gameInstructions.style.marginBottom = '1.5rem';
	gameInstructions.innerHTML = `
		<p style="margin-bottom: 0rem">Blast matching colored spheres to score!</p>
		<p>Beat the clock. How high can you go?</p>
	`;

	// Add control diagram
	const controlDiagram = document.createElement('img');
	controlDiagram.src = 'assets/diagram.png';
	controlDiagram.alt = 'Game Controls';
	controlDiagram.style.width = 'auto';
	controlDiagram.style.height = '300px';
	controlDiagram.style.display = 'block';
	controlDiagram.style.margin = '-65px auto -1.5rem auto';

	// Assemble title card
	titleCard.appendChild(titleImage);
	titleCard.appendChild(gameInstructions);
	titleCard.appendChild(controlDiagram);
	titleCard.appendChild(startButton);
	document.body.appendChild(titleCard);

	// Add credits text
	const creditsText = document.createElement('div');
	creditsText.style.position = 'fixed';
	creditsText.style.bottom = '20px';
	creditsText.style.right = '20px';
	creditsText.style.color = 'white';
	creditsText.style.fontFamily = 'monospace';
	creditsText.style.fontSize = '14px';
	creditsText.style.textAlign = 'right';
	creditsText.style.zIndex = '1000';
	creditsText.innerHTML = `Created by: Ikram Hakim<br><a href="https://x.com/Kaberikram" target="_blank" style="color: #1DA1F2; text-decoration: none;">@Kaberikram</a>`;
	document.body.appendChild(creditsText);

	// Style the page background - changed to a darker gradient to match black theme
	document.body.style.background = 'linear-gradient(to bottom, #000000, #121212)';
}
