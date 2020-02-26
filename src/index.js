require('three');
require('aframe');
require('aframe-physics-system');

const searchQueryParser = require('search-query-parser').parse;
const FileBuffer = require('buffer').Buffer
const Zlib = require('zlib');
const JSZip = new (require('jszip'))();

require('./math2');
require('./colors');
require('./customMesh');
require('./geometryHelpers');
require('./aframe-random-tree');

const moveDirection = new THREE.Vector3();

const mapData = {
	dataFileObject: null,
	notes: []
};

let playing = false;
let startTime = 0;
let lastFrameTime = 0;
let difficulties = [];
let map = [];

AFRAME.registerComponent('handtarget', {});

const {
	beatId
} = searchQueryParser(location.search.replace(/\?/gm, ''), {keywords: ['beatId']});

const files = fetch(`https://beatsaver.com/api/download/key/${beatId}`)
	.then(response => response.arrayBuffer())
	.then(zipString => JSZip.loadAsync(zipString))
	.then(() => JSZip.file('info.dat').async('string'))
	.then(JSON.parse)
	.then(dataFileObject => {
		mapData.dataFileObject = dataFileObject;
		mapData.songBpm = dataFileObject._beatsPerMinute;
		const fileName = dataFileObject._difficultyBeatmapSets[0]._difficultyBeatmaps[0]._beatmapFilename;
		return JSZip.file(fileName).async('string')
	})
	.then(JSON.parse)
	.then(levelData => {
		mapData.notes = levelData._notes
		console.log(mapData.notes)
		// mapData.notes.filter((v, i) => i < 100).forEach(note => {
		// 	const {_lineIndex, _lineLayer, _time, _type, _cutDirection} = note;
		// 	createAnEntity(_lineIndex, _lineLayer, _time, _type, _cutDirection);
		// })
	})

let score = 0;

const playerControllsStore = {
	rightTrigger: {
		lastPressed: false
	}
};

function getCutDirection (cutDirection) {
	switch (cutDirection) {
		case 0: return 180;
		case 1: return 0;
		case 2: return 90;
		case 3: return 270;
		default: console.log(cutDirection); return 0;
	}
}

function scoreValue (score) {
	return `font: https://cdn.aframe.io/fonts/mozillavr.fnt; align: center; value: ${score}`
}
const sceneEl = document.createElement('a-scene');
sceneEl.setAttribute('physics', 'gravity: 0'); // debug: true; driver: local;
document.body.appendChild(sceneEl);

const groundElement = document.createElement('a-plane');
groundElement.setAttribute('color', 'green');
groundElement.setAttribute('height', '100');
groundElement.setAttribute('width', '100');
groundElement.setAttribute('rotation', '-90 0 0');
// groundElement.setAttribute('static-body', '');
sceneEl.appendChild(groundElement);

const relativeBoxElement = document.createElement('a-box');
relativeBoxElement.setAttribute('color', 'magenta');
relativeBoxElement.setAttribute('height', '1');
relativeBoxElement.setAttribute('width', '1');
relativeBoxElement.setAttribute('depth', '1');
relativeBoxElement.setAttribute('rotation', '0 30 0');
relativeBoxElement.setAttribute('position', {x: 2, y: .5 + 5, z: 2});
relativeBoxElement.setAttribute('dynamic-body', 'shape: box');
sceneEl.appendChild(relativeBoxElement);

const cameraRig = document.createElement('a-entity');
cameraRig.setAttribute('position', '0 0 0');
cameraRig.setAttribute('custom-controls');

const leftHand = document.createElement('a-entity');
leftHand.setAttribute('hand-controls', `hand: left; handModelStyle: lowPoly; color: orange`);
const leftHandPivot = document.createElement('a-entity');
leftHandPivot.setAttribute('rotation', '-45 0 0');
const leftHandBox = document.createElement('a-box');
leftHandBox.setAttribute('color', 'red');
leftHandBox.setAttribute('height', '1');
leftHandBox.setAttribute('width', '.05');
leftHandBox.setAttribute('depth', '.05');
leftHandBox.setAttribute('position', '0 .4 0');
leftHandBox.setAttribute('static-body', 'shape: box');
leftHandPivot.appendChild(leftHandBox);
leftHand.appendChild(leftHandPivot);
cameraRig.appendChild(leftHand);

const rightHand = document.createElement('a-entity');
rightHand.setAttribute('hand-controls', `hand: right; handModelStyle: lowPoly; color: orange`);
const rightHandPivot = document.createElement('a-entity');
rightHandPivot.setAttribute('rotation', '-45 0 0');
const rightHandBox = document.createElement('a-box');
rightHandBox.setAttribute('color', 'blue');
rightHandBox.setAttribute('height', '1');
rightHandBox.setAttribute('width', '.05');
rightHandBox.setAttribute('depth', '.05');
rightHandBox.setAttribute('position', '0 .4 0');
rightHandBox.setAttribute('static-body', 'shape: box');
rightHandPivot.appendChild(rightHandBox);
rightHand.appendChild(rightHandPivot);
cameraRig.appendChild(rightHand);

const camera = document.createElement('a-camera');
cameraRig.setAttribute('position', '0 0 0');
cameraRig.setAttribute('custom-controls');
cameraRig.appendChild(camera);

const scoreDisplay = document.createElement('a-entity');
scoreDisplay.setAttribute('text', scoreValue(score));
scoreDisplay.setAttribute('position', '0 1 2');
scoreDisplay.setAttribute('rotation', '15 180 0');
scoreDisplay.setAttribute('scale', '10 10 10');
cameraRig.appendChild(scoreDisplay);

sceneEl.appendChild(cameraRig);

const collide = saberHand => e => {
	if (e.detail.body.el.removed) {
		return;
	}

	e.detail.body.el.removed = true;
	// e.detail.target.el;  // Original entity (playerEl).
	// e.detail.body.el;    // Other entity, which playerEl touched.

	const boxHand = e.detail.body.el.getAttribute('handtarget');

	if (boxHand === saberHand) {
		score += 1;
	}
	else {
		score -= 3;
	}

	sceneEl.removeChild(e.detail.body.el);

	// e.detail.contact;    // Stats about the collision (CANNON.ContactEquation).
	// e.detail.contact.ni; // Normal (direction) of the collision (CANNON.Vec3).
}
rightHandBox.addEventListener('collide', collide('right'));
leftHandBox.addEventListener('collide', collide('left'));

function getWorldPosition(sceneObject) {
	return cameraRig.object3D.position.clone().add(sceneObject.object3D.position);
}

function getRandomColor() {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

function createAnEntity(noteIndex, index, layer, time, type, cutDirection) {
	const anEntity = document.createElement('a-entity');
	anEntity.setAttribute('geometry', {
		primitive: 'box',
		height: .5,
		width: .5,
		depth: .5
	});
	const hand = type ? 'left' : 'right';
	anEntity.setAttribute('handtarget', hand);
	anEntity.setAttribute('position', `${(index - 2) / 2} ${layer / 2 + .6} 10`);
	anEntity.setAttribute('material', 'color', hand === 'right' ? 'blue' : 'red');
	anEntity.setAttribute('dynamic-body', 'shape: box');
	anEntity.setAttribute('impulsed', false);
	
	const cutDirectionDisplay = document.createElement('a-entity');
	cutDirectionDisplay.setAttribute('text', `font: https://cdn.aframe.io/fonts/mozillavr.fnt; align: center; value: v`);
	cutDirectionDisplay.setAttribute('position', '0 0.12 -0.26');
	cutDirectionDisplay.setAttribute('rotation', `0 180 ${getCutDirection(cutDirection)}`);
	cutDirectionDisplay.setAttribute('scale', '10 10 10');
	anEntity.appendChild(cutDirectionDisplay);

	sceneEl.appendChild(anEntity);
	return anEntity;
}

let entities = [];

let time = 0;
let noteIndex = 0;
// setInterval(() => {
// 	entities.push(createAnEntity());
// }, 400)

setInterval(() => {
	if (!playing && mapData.notes.length) {
		console.log('starting!');
		playing = true;
	}
	
	if (playing) {
		time += ((1000 / 60) / 1000) * mapData.songBpm / 60 ;
	}

	while (playing && mapData.notes[noteIndex]._time < time) {
		const {_lineIndex, _lineLayer, _time, _type, _cutDirection} = mapData.notes[noteIndex];
		createAnEntity(noteIndex, _lineIndex, _lineLayer, _time, _type, _cutDirection);
		noteIndex++;
	}

	scoreDisplay.setAttribute('text', scoreValue(score));

	entities.forEach(entity => {
		// if (entity.removed === true) return;
		// entity.object3D.position.z -= .2;

		if (entity.object3D.position.z < -5) {
			sceneEl.removeChild(entity);
			entity.removed = true;
			score-=5;
		}

		if (entity.object3D.position.z > 100) {
			sceneEl.removeChild(entity);
			entity.removed = true;
		}

		
		if (entity.object3D.position.x > 10 || entity.object3D.position.x < -10) {
			sceneEl.removeChild(entity);
			entity.removed = true;
		}
	});

	entities = entities.filter(entity => !entity.removed);

	const el = sceneEl.querySelector('[impulsed=false]')
	if (el && el.body) {
		// el.body.applyImpulse(new CANNON.Vec3(0, 0, Math.min(-(20 + score), -10)), new CANNON.Vec3(0, 0, 0));
		el.body.applyImpulse(new CANNON.Vec3(0, 0, -17 * 2), new CANNON.Vec3(0, 0, 0));
		el.setAttribute('impulsed', true);
	}
	
	if (navigator.getGamepads && navigator.getGamepads().length) {
		const controllers = navigator.getGamepads();
		const leftController = controllers.find(controller => controller.hand === 'left');
		const rightController = controllers.find(controller => controller.hand === 'right');
		if (leftController) {
			const [ rightLeftAxis1, forwardBackAxis1, rightLeftAxis2, forwardBackAxis2 ] = leftController.axes;
			cameraRig.object3D.position
				.add(new THREE.Vector3(rightLeftAxis2, 0, -forwardBackAxis2)
				.applyQuaternion(camera.object3D.getWorldQuaternion()).multiplyScalar(.1))
				.multiply(new THREE.Vector3(1, 0, 1));
		}
		if (rightController) {
			const [ rightLeftAxis1, forwardBackAxis1, rightLeftAxis2, forwardBackAxis2 ] = rightController.axes;
			const [ , trigger ] = rightController.buttons;
			// cameraRig.object3D.position.x -= rightLeftAxis1 === 0 ? rightLeftAxis2 : rightLeftAxis1;
			// cameraRig.object3D.position.z += forwardBackAxis1 === 0 ? forwardBackAxis2 : forwardBackAxis1;
			if (!rightLeftAxis2) {}
			else if (rightLeftAxis2 < 0) { cameraRig.object3D.rotateY(3.14 / 30) }
			else if (rightLeftAxis2 > 0) { cameraRig.object3D.rotateY(-3.14 / 30) }

			if (trigger.pressed && !playerControllsStore.rightTrigger.lastPressed) {
				playerControllsStore.rightTrigger.lastPressed = true;
			}

			if (!trigger.pressed) {
				playerControllsStore.rightTrigger.lastPressed = false;
			}
		}
	}
}, 1000 / 60)

// AFRAME.registerComponent('query-selector-example', {
//   init: function () {
//     this.entities = document.querySelectorAll('.box');
//   },
  
//   tick: function () {
//     // Don't call query selector in here, query beforehand.
//     for (let i = 0; i < this.entities.length; i++) {
//       // Do something with entities.
//     }
//   }
// });
