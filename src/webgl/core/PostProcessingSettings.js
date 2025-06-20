export default class PostProcessingSettings {
    constructor() {
        this.sceneSettings = {
            main: {
                bloom: {
                    enabled: true,
                    type: 'SELECTIVE', // 'LUMINOSITY', 'SELECTIVE', 'TEXTURE'
                    strength: 2.61,
                    radius: 0.59,
                    threshold: 0,
                    smoothWidth: 0.67,
                    resolution: { x: 256, y: 256 },
                }
                // Example for selective bloom:
                // bloom: {
                // 	enabled: true,
                // 	type: 'SELECTIVE', // Only objects with userData.renderBloom = true will bloom
                // 	strength: 2.0,
                // 	radius: 0.5,
                // 	threshold: 0.0, // Not used in selective mode
                // 	smoothWidth: 1.0, // Not used in selective mode
                // 	resolution: { x: 256, y: 256 },
                // }
            },
            camera: {
                bloom: {
                    enabled: false
                }
            },
            score: {
                bloom: {
                    enabled: false
                }
            }
        }
    }

    getSettings(sceneName, effectName) {
        const scene = this.sceneSettings[sceneName?.toLowerCase()]
        if (!scene) return null

        return scene[effectName] || null
    }

    updateSetting(sceneName, effectName, property, value) {
    }

    getBloomSettings(sceneName) {
        return this.getSettings(sceneName, 'bloom')
    }

    updateBloomSetting(sceneName, property, value) {
        return this.updateSetting(sceneName, 'bloom', property, value)
    }
} 