import Socket from '@/scripts/Socket.js'
import Experience from 'core/Experience.js'
import { MAIN_ROULETTE_CONFIG } from 'webgl/modules/MachineManager.js'
import initSecondScreenMessage from '@/scripts/secondScreenMessage.js'
import { gsap } from 'gsap'
import { RoughEase } from 'gsap/EasePack'
import { flickerAnimation } from '@/scripts/uiAnimations.js'
import { Color } from 'three'
gsap.registerPlugin(RoughEase)

const autoShow = false
const canvasElement = document.querySelector('canvas#webgl')
const overlayElement = document.querySelector('.overlay')
const combiElement = document.querySelector('.combi')
const fullscreenTextElement = document.querySelector('.fullscreen-text')
const innerTextElement = document.querySelector('.inner-text')
const jackpotVideoElements = document.querySelectorAll('.jackpot-video')
const sideElements = document.querySelectorAll('.left-side, .right-side')
const rightScreamerVideoElement = document.querySelector('.right-screamer-video')

const experience = new Experience(canvasElement)
const socket = new Socket()
socket.connect('combi')

const emojiBackgrounds = {
	'🍒': '58.5%',
	'🍊': '40%',
	'🍇': '21.5%',
	'🍋': '1%',
	'💀': '78%',
	7: '97%',
}

const multiplierOrder = ['x1', 'x3', 'x4', 'x5']
const symbolOrder = MAIN_ROULETTE_CONFIG.symbolNames

function buildMatrix() {
	const matrix = [['-', ...multiplierOrder]]

	MAIN_ROULETTE_CONFIG.symbolNames.reverse().forEach((emoji) => {
		const emojiValue = MAIN_ROULETTE_CONFIG.symbolValues[emoji]
		const { triple, quadruple, quintuple } = MAIN_ROULETTE_CONFIG.occurrencePoints
		const malusPoints = MAIN_ROULETTE_CONFIG.malusPoints
		if (emojiValue === 'malus') {
			matrix.push([emoji, malusPoints[1], 'FARKLE', 'FARKLE', 'FARKLE'])
		} else if (emojiValue === 'special') {
			matrix.push([emoji, '-', 'SPECIAL', 'SPECIAL', 'SPECIAL'])
		} else {
			// Utilisation de combinationPoints si disponible
			const row = [emoji]
			const symbolCounts = [1, 3, 4, 5]
			for (let i = 0; i < multiplierOrder.length; i++) {
				const key = `${symbolCounts[i]}${emoji}`
				if (MAIN_ROULETTE_CONFIG.combinationPoints.hasOwnProperty(key)) {
					row.push(MAIN_ROULETTE_CONFIG.combinationPoints[key])
				} else {
					if (i === 0) {
						row.push(emojiValue > 0 ? emojiValue : '-')
					} else if (i === 1) {
						row.push(emojiValue * 3 + triple)
					} else if (i === 2) {
						row.push(emojiValue * 4 + quadruple)
					} else if (i === 3) {
						row.push(emojiValue * 5 + quintuple)
					}
				}
			}
			matrix.push(row)
		}
	})
	return matrix
}

function createCell(cell, yIndex, xIndex) {
	const cellElement = document.createElement('div')
	cellElement.classList.add('combi__item')
	cellElement.dataset.row = yIndex
	cellElement.dataset.column = xIndex
	cellElement.dataset.content = cell
	flickerAnimation(cellElement)

	const borderElement = document.createElement('div')
	borderElement.classList.add('combi__item-border')
	cellElement.appendChild(borderElement)

	if (Object.prototype.hasOwnProperty.call(emojiBackgrounds, cell)) {
		const img = document.createElement('div')
		img.classList.add('combi__item-img')
		img.style.backgroundPositionY = emojiBackgrounds[cell]
		cellElement.appendChild(img)
	} else {
		const textElement = document.createElement('div')
		textElement.classList.add('combi__item-text')
		textElement.innerHTML = `<span>${cell}</span>`
		cellElement.appendChild(textElement)
		const scaleFactor = Math.min(3 / textElement.textContent.length, 1)
		textElement.style.transform = `scaleX(${scaleFactor})`
	}
	return cellElement
}

function renderMatrix(matrix, combiElement) {
	matrix.forEach((row, yIndex) => {
		row.forEach((cell, xIndex) => {
			const cellElement = createCell(cell, yIndex, xIndex)
			combiElement.appendChild(cellElement)
		})
	})
}

const matrix = buildMatrix()
renderMatrix(matrix, combiElement)

let lastOverlayElement = null

function cloneAndBlur() {
	if (lastOverlayElement) lastOverlayElement.remove()
	const overlayClone = overlayElement.cloneNode(true)
	overlayClone.classList.add('overlay-blur')
	combiElement.parentNode.appendChild(overlayClone)
	lastOverlayElement = overlayClone
}

function resetCombi() {
	combiElement.querySelectorAll('.combi__item--active').forEach((cell) => {
		cell.classList.remove('combi__item--active')
	})
	cloneAndBlur()
}

function updateCombi({ symbol, value }) {
	// x2 est équivalent à x1
	if (value === 'x2') value = 'x1'
	const symbolIndex = symbolOrder.indexOf(symbol)
	const multiplierIndex = multiplierOrder.indexOf(value)
	if (symbolIndex === -1 || multiplierIndex === -1) {
		console.warn('Invalid symbol or value:', symbol, value)
		return
	}
	combiElement
		.querySelectorAll(`.combi__item[data-row="${symbolIndex + 1}"].combi__item--active`)
		.forEach((cell) => cell.classList.remove('combi__item--active'))
	const cellElement = combiElement.querySelector(
		`.combi__item[data-row="${symbolIndex + 1}"][data-column="${multiplierIndex + 1}"]`,
	)
	if (cellElement) {
		cellElement.classList.add('combi__item--active')
	}
	// Affichage des points si la combinaison existe
	const combiKey = `${multiplierIndex + 3}${symbol}` // x1=3, x3=4, x4=5, x5=6 symboles
	cloneAndBlur()
}

cloneAndBlur()
socket.on('update-combi', updateCombi)
socket.on('reset-combi', resetCombi)
socket.on('reset', resetCombi)
socket.on('hide', hide)
socket.on('show', show)
socket.on('jackpot', jackpot)
socket.on('jackpot-end', jackpotEnd)
socket.on('farkle', farkle)
socket.on('lose-final', loseFinal)

function loseFinal() {
	experience.sceneManager.combi.tint = new Color('#ff4726')
	gsap.to(overlayElement, {
		autoAlpha: 0,
		duration: 0.5,
	})

	rightScreamerVideoElement.style.display = 'initial'
	rightScreamerVideoElement.play()
	rightScreamerVideoElement.playbackRate = 1.2
	rightScreamerVideoElement.onended = () => {
		// hide all
		rightScreamerVideoElement.style.display = 'none'
		gsap.set(overlayElement, {
			autoAlpha: 1,
		})
		hide({ immediate: true })
		experience.sceneManager.combi.tint = new Color('white')
	}
}

function farkle() {
	gsap.to(sideElements, {
		background: '#ff4726',
		ease: "rough({ template: 'none', strength: 2, points: 10, randomize: true })",
	})
	experience.sceneManager.combi.tint = new Color('#ff4726')
	gsap.to(overlayElement, {
		'--primary-color': '#ff4726',
		ease: "rough({ template: 'none', strength: 2, points: 10, randomize: true })",
	})

	gsap.delayedCall(3, () => {
		gsap.to(sideElements, {
			background: '',
			ease: "rough({ template: 'none', strength: 2, points: 10, randomize: true })",
		})
		gsap.to(overlayElement, {
			'--primary-color': '',
			ease: "rough({ template: 'none', strength: 2, points: 10, randomize: true })",
		})
		experience.sceneManager.combi.tint = new Color('white')
	})
}

function jackpot({ symbol, count }) {
	gsap.to(jackpotVideoElements, {
		autoAlpha: 1,
		delay: 0.1,
		ease: "rough({ template: 'none', strength: 2, points: 10, randomize: true })",
	})

	switch (symbol) {
		case '🍋':
			gsap.to(sideElements, {
				background: '#d9ffd9',
				ease: "rough({ template: 'none', strength: 2, points: 10, randomize: true })",
			})
			experience.sceneManager.combi.tint = new Color('#d9ffd9')
			gsap.to(overlayElement, {
				'--primary-color': '#d9ffd9',
				ease: "rough({ template: 'none', strength: 2, points: 10, randomize: true })",
			})
			break
		case '🍒':
			gsap.to(sideElements, {
				background: '#ff99cc',
				ease: "rough({ template: 'none', strength: 2, points: 10, randomize: true })",
			})
			gsap.to(overlayElement, {
				'--primary-color': '#ff99cc',
				ease: "rough({ template: 'none', strength: 2, points: 10, randomize: true })",
			})
			experience.sceneManager.combi.tint = new Color('#ff99cc')
			break
		case '🍊':
			gsap.to(sideElements, {
				background: '#ffd280',
				ease: "rough({ template: 'none', strength: 2, points: 10, randomize: true })",
			})
			gsap.to(overlayElement, {
				'--primary-color': '#ffd280',
				ease: "rough({ template: 'none', strength: 2, points: 10, randomize: true })",
			})
			experience.sceneManager.combi.tint = new Color('#ffd280')
			break
		case '🍇':
			gsap.to(sideElements, {
				background: '#804d80',
				ease: "rough({ template: 'none', strength: 2, points: 10, randomize: true })",
			})
			gsap.to(overlayElement, {
				'--primary-color': '#804d80',
				ease: "rough({ template: 'none', strength: 2, points: 10, randomize: true })",
			})
			experience.sceneManager.combi.tint = new Color('#804d80')
			break
		case '7':
			gsap.to(sideElements, {
				background: '#80ffff',
				ease: "rough({ template: 'none', strength: 2, points: 10, randomize: true })",
			})
			gsap.to(overlayElement, {
				'--primary-color': '#80ffff',
				ease: "rough({ template: 'none', strength: 2, points: 10, randomize: true })",
			})
			experience.sceneManager.combi.tint = new Color('#80ffff')
	}
}

function jackpotEnd() {
	gsap.to(jackpotVideoElements, {
		autoAlpha: 0,
		ease: "rough({ template: 'none', strength: 2, points: 10, randomize: true })",
	})
	gsap.to(sideElements, {
		background: '',
		ease: "rough({ template: 'none', strength: 2, points: 10, randomize: true })",
	})
	gsap.to(overlayElement, {
		'--primary-color': '',
		ease: "rough({ template: 'none', strength: 2, points: 10, randomize: true })",
	})
	experience.sceneManager.combi.tint = new Color('white')
}

function show({ immediate = false } = {}) {
	if (immediate) {
		combiElement.style.opacity = 1
		gsap.set(sideElements, { autoAlpha: 1 })
		experience.sceneManager.combi.showAnimation(immediate)
		cloneAndBlur()
		return
	}
	gsap.fromTo(
		[combiElement, ...sideElements],
		{ autoAlpha: 0 },
		{
			autoAlpha: 1,
			duration: 1,
			delay: 1,
			onComplete: () => {
				cloneAndBlur()
			},
		},
	)

	experience.sceneManager.combi.showAnimation(immediate)
}

function hide({ immediate = false } = {}) {
	if (immediate) {
		combiElement.style.opacity = 0
		experience.sceneManager.combi.hideAnimation(immediate)
		gsap.set(sideElements, { autoAlpha: 0 })
		cloneAndBlur()
		return
	}
	gsap.fromTo(
		combiElement,
		{ opacity: 1 },
		{
			opacity: 0,
			duration: 0.5,
			delay: 0.5,
			onComplete: () => {
				cloneAndBlur()
			},
		},
	)
	gsap.to(sideElements, {
		autoAlpha: 0,
		duration: 0.5,
		delay: 0.5,
		ease: "rough({ template: 'none', strength: 2, points: 10, randomize: true })",
	})

	experience.sceneManager.combi.hideAnimation(immediate)
}

function fullscreenCallback(textElement) {
	fullscreenTextElement.appendChild(textElement)
	gsap.fromTo(
		[canvasElement, combiElement, ...sideElements],
		{
			autoAlpha: 1,
		},
		{
			autoAlpha: 0,
			ease: "rough({ template: 'none', strength: 2, points: 10, randomize: true })",
			onUpdate: cloneAndBlur,
		},
	)
}

function innerCallback(textElement) {
	innerTextElement.appendChild(textElement)
	gsap.fromTo(
		[combiElement, ...sideElements],
		{ autoAlpha: 1 },
		{
			autoAlpha: 0,
			ease: "rough({ template: 'none', strength: 2, points: 10, randomize: true })",
			onUpdate: cloneAndBlur,
		},
	)
}

function hideCallback() {
	fullscreenTextElement.innerHTML = ''
	innerTextElement.innerHTML = ''
	gsap.fromTo(
		[canvasElement, combiElement, ...sideElements],
		{
			autoAlpha: 0,
		},
		{
			autoAlpha: 1,
			ease: "rough({ template: 'none', strength: 2, points: 10, randomize: true })",
			onUpdate: cloneAndBlur,
		},
	)
}

initSecondScreenMessage(socket, fullscreenCallback, innerCallback, hideCallback)

// if is an iframe
document.querySelector('html').style.fontSize = innerHeight * 0.015625 + 'px'

if (autoShow) {
	experience.sceneManager._scene.resources.on('ready', () => {
		show({ immediate: true })
	})
}
