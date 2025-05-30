import Experience from 'core/Experience.js'
import {
	Scene,
	BoxGeometry,
	Mesh,
	ShaderMaterial,
	Vector3,
	MeshBasicMaterial,
	Vector2,
	RepeatWrapping,
	MeshMatcapMaterial,
	Color,
	MeshStandardMaterial,
	DirectionalLight,
	MeshPhongMaterial,
} from 'three'
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js'
import gsap from 'gsap'
import addObjectDebug from 'utils/addObjectDebug.js'
import addMaterialDebug from '@/webgl/utils/addMaterialDebug'
import Socket from '@/scripts/Socket.js'

const socket = new Socket()
socket.connect('physical-debug')

export default class PhysicalDebug {
	constructor() {
		this._experience = new Experience()
		this._scene = this._experience.scene
		this._debug = this._experience.debug
		this._resources = this._scene.resources
		this._machine = this._experience.activeScene.machine
		this._hands = this._experience.activeScene.hands
		this._buttonLightsEnabled = Array(5).fill(false)

		this._resource = this._resources.items.physicalPartsModel

		this._createMaterials()
		this._createModel()
		this._createInteraction()
		// this._css3dRenderer = this._createCss3dRenderer()
		// this._css3dScene = this._createCss3dScene()
		this._cssScreen = this._createCssScreen()
		// this._css3dScreen = this._createCss3dScreen()

		this._createEventListeners()

		if (this._debug.active) this._createDebug()
	}

	// public
	printToRightScreen(message) {
		if (!this._rightScreen) return
		// create element on right screen
		const element = document.createElement('div')
		element.className = 'right-screen-text'
		element.textContent = message
		element.style.color = '#ffffff'
		element.style.fontSize = '15px'
		element.style.fontFamily = 'Arial, sans-serif'
		this._rightScreen.appendChild(element)

		// scroll right screen to the bottom
		this._rightScreen.scrollTop = this._rightScreen.scrollHeight
	}

	// private
	_createModel() {
		this._model = this._resource.scene
		this._model.name = 'physical machine parts'
		this._scene.add(this._model)

		this._leds = []

		const collectButtonTexture = this._resources.items.collectButtonTexture
		collectButtonTexture.flipY = false

		this._model.traverse((child) => {
			if (!child.isMesh) return
			if (child.name.includes('led')) {
				this._leds.push(child)
			} else if (child.name.includes('base')) {
				child.material = new MeshMatcapMaterial({ matcap: this._resources.items.goldMatcap })
			} else if (child.name.includes('collect')) {
				child.material = new MeshBasicMaterial({ map: collectButtonTexture })
				this._collectButton = child
			} else if (child.name.includes('machine')) {
				child.material = new MeshBasicMaterial({ color: new Color(0x000000) })
			} else if (child.name.includes('lever')) {
				this._lever = child
				child.material = new MeshPhongMaterial({ color: new Color(0x444444) })
			} else if (child.name.includes('ball')) {
				child.material = new MeshPhongMaterial({ color: new Color(0xff0000) })
			} else if (child.name.includes('screen')) {
				this._doubleScreenPlane = child
				this._doubleScreenPlane.visible = false
			}
		})

		this._leds.forEach((led, i) => {
			led.material = this._ledWhiteMaterial
			led.isWhite = true
		})
	}

	_createMaterials() {
		this._ledMaterials = [
			new MeshBasicMaterial({ color: 0xffff00 }), // Yellow
			new MeshBasicMaterial({ color: 0xff0000 }), // Red
			new MeshBasicMaterial({ color: 0x0000ff }), // Blue
			new MeshBasicMaterial({ color: 0x008000 }), // Green
			new MeshBasicMaterial({ color: 0xff00f0 }), // Orange
		]

		this._ledWhiteMaterial = new MeshBasicMaterial({ color: 0xffffff })
	}

	_createCss3dRenderer() {
		const renderer = new CSS3DRenderer()
		renderer.setSize(window.innerWidth, window.innerHeight)
		renderer.domElement.style.position = 'fixed'
		renderer.domElement.style.top = 0
		renderer.domElement.style.pointerEvents = 'none'
		document.body.appendChild(renderer.domElement)

		return renderer
	}

	_createCss3dScene() {
		const scene = new Scene()

		return scene
	}

	_createCss3dScreen() {
		const screenElement = document.querySelector('.top-screens')

		this._spinsElement = screenElement.querySelector('.spins')
		this._roundsElement = screenElement.querySelector('.round')
		this._collectedElement = screenElement.querySelector('.score')
		this._rollingElement = screenElement.querySelector('.current')
		this._rightScreen = screenElement.querySelector('.right-screen')
		this._videoElement = screenElement.querySelector('.joined-screen')

		const cssObject = new CSS3DObject(screenElement)

		cssObject.position.copy(this._doubleScreenPlane.position)

		cssObject.rotation.x = this._doubleScreenPlane.rotation.x - Math.PI / 2
		cssObject.scale.set(0.005, 0.005, 0.005)

		this._css3dScene.add(cssObject)

		return cssObject
	}

	_createCssScreen() {
		const screenElement = document.querySelector('.top-screens')

		this._spinsElement = screenElement.querySelector('.spins')
		this._roundsElement = screenElement.querySelector('.round')
		this._collectedElement = screenElement.querySelector('.score')
		this._rollingElement = screenElement.querySelector('.current')
		this._rightScreen = screenElement.querySelector('.right-screen')
		this._videoElement = screenElement.querySelector('.joined-screen')
	}

	_createInteraction() {
		this._experience.interactionManager.addInteractiveObject(this._lever)
		this._lever.addEventListener('click', (e) => {
			this._leverClickHandler()
		})

		this._experience.interactionManager.addInteractiveObject(this._collectButton)
		this._collectButton.addEventListener('click', (e) => {
			this._collectButtonClickHandler()
		})

		this._leds.forEach((led, i) => {
			this._experience.interactionManager.addInteractiveObject(led)

			led.addEventListener('click', (e) => {
				socket.send({
					event: 'button',
					data: {
						index: i,
					},
					receiver: ['machine', 'shooter'],
				})

				if (this._buttonLightsEnabled[i]) {
					led.isWhite = !led.isWhite
					led.material = led.isWhite ? this._ledWhiteMaterial : this._ledMaterials[i]
				}
			})
		})
	}

	_leverClickHandler() {
		if (this._isCliked) return
		this._isCliked = true

		gsap.killTweensOf(this._lever.rotation)
		gsap.to(this._lever.rotation, {
			duration: 0.5,
			x: -1.5,
			ease: 'power1.inOut',
			yoyo: true,
			repeat: 1,
		})

		gsap.delayedCall(0.15, () => {
			socket.send({
				event: 'lever',
				receiver: 'machine', // add physical non-debug too
			})
		})

		gsap.delayedCall(1, () => {
			this._isCliked = false
		})
	}

	_collectButtonClickHandler() {
		this._collectButton.material.color.set(0x008000)

		gsap.delayedCall(0.1, () => {
			this._collectButton.material.color.set(0xffffff)
		})

		socket.send({
			event: 'button-collect',
			receiver: 'machine', // add physical non-debug too
		})
	}

	_createEventListeners() {
		window.addEventListener('resize', () => {
			// this._css3dRenderer.setSize(window.innerWidth, window.innerHeight)
		})

		// listen to f g h j k and send corresponding index button events to machine and shooter
		window.addEventListener('keydown', (e) => {
			if (e.key === 'f') {
				socket.send({
					event: 'button',
					data: { index: 0 },
					receiver: ['machine', 'shooter'],
				})
			} else if (e.key === 'g') {
				socket.send({
					event: 'button',
					data: { index: 1 },
					receiver: ['machine', 'shooter'],
				})
			} else if (e.key === 'h') {
				socket.send({
					event: 'button',
					data: { index: 2 },
					receiver: ['machine', 'shooter'],
				})
			} else if (e.key === 'j') {
				socket.send({
					event: 'button',
					data: { index: 3 },
					receiver: ['machine', 'shooter'],
				})
			} else if (e.key === 'k') {
				socket.send({
					event: 'button',
					data: { index: 4 },
					receiver: ['machine', 'shooter'],
				})
			} else if (e.key === 'Enter') {
				this._collectButtonClickHandler()
			} else if (e.key === ' ') {
				e.preventDefault() // Prevent default space behavior (scrolling)
				this._leverClickHandler()
			}
		})

		socket.on('update-collected-points', (e) => {
			this._updateCollectedPointsHandler(e)
		})
		socket.on('update-rolling-points', (e) => {
			this._updateRollingPointsHandler(e)
		})
		socket.on('update-spin-tokens', (e) => {
			this._updateSpinTokensHandler(e)
		})
		socket.on('update-rounds', (e) => {
			this._updateRounds(e)
		})
		socket.on('update-quota', (e) => {
			this._updateQuota(e)
		})
		socket.on('button-lights-enabled', (e) => {
			this._buttonLightsEnabledHandler(e)
		})
		socket.on('reset-buttons-light', (e) => {
			this._resetButtonsLightHandler(e)
		})
	}

	_updateCollectedPointsHandler(e) {
		this._collectedElement.textContent = e.value
	}

	_updateRollingPointsHandler(e) {
		this._rollingElement.textContent = e.value
	}

	_updateSpinTokensHandler(e) {
		if (e.value === '+1') {
			this._spinsElement.textContent = parseInt(this._spinsElement.textContent) + 1
		} else {
			this._spinsElement.textContent = e.value
		}
	}

	_buttonLightsEnabledHandler(e) {
		const value = e.value
		const index = e.index
		console.log('button lights enabled', value, index)
		if (index === -1) {
			this._buttonLightsEnabled.fill(value)
			this._leds.forEach((led, i) => {
				led.material = this._ledWhiteMaterial
				led.isWhite = true
			})
		} else {
			this._buttonLightsEnabled[index] = value
		}
	}

	_resetButtonsLightHandler() {
		this._leds.forEach((led, i) => {
			led.material = this._ledWhiteMaterial
			led.isWhite = true
		})
	}

	update() {
		if (this._css3dRenderer) this._css3dRenderer.render(this._css3dScene, this._experience.camera.instance)
	}

	_createDebug() {
		const folder = this._debug.ui.addFolder({
			title: 'Physical Parts',
			expanded: true,
		})
	}
}
