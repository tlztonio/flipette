#define PHONG

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewPosition;

uniform float uAmbientIntensity;
uniform float uDiffuseIntensity;
uniform float uSpecularIntensity;
uniform float uShininess;
uniform float uOpacity;

uniform vec3 uAmbientColor;
uniform vec3 uDiffuseColor;
uniform vec3 uSpecularColor;
uniform vec3 uEmissiveColor;

#ifdef USE_ALBEDO
	uniform sampler2D uAlbedoMap;
	uniform vec2 uAlbedoRepeat;
	uniform float uAlbedoIntensity;
#endif

#ifdef USE_MATCAP
	uniform sampler2D uMatcapMap;
	uniform vec2 uMatcapOffset;
	uniform float uMatcapIntensity;
#endif

#ifdef USE_ROUGHNESS
	uniform sampler2D uRoughnessMap;
	uniform vec2 uRoughnessRepeat;
	uniform float uRoughnessIntensity;
#endif

#ifdef USE_AO
	uniform sampler2D uAOMap;
	uniform vec2 uAOMapRepeat;
	uniform float uAOMapIntensity;
#endif

// UPDATE DUPLICATED SHADER MATS
// AND SET CORRECT SELECTIVE LIGHTS

#include <common>
#include <fog_pars_fragment>
#include <bsdfs>
#include <custom_lights_phong_pars_fragment>

#ifdef USE_NORMAL
	uniform sampler2D uNormalMap;
	uniform vec2 uNormalRepeat;
	uniform vec2 uNormalScale;
#endif

#ifdef USE_MATCAP
	vec3 matcap(float roughness) {
		vec3 newNormal = normalize(vNormal);
		vec3 viewDir = normalize(vViewPosition);
		vec3 x = normalize(vec3(viewDir.z, 0.0, - viewDir.x));
		vec3 y = cross(viewDir, x);
		vec2 uv = vec2(dot(x, newNormal), dot(y, newNormal)) * 0.495 + 0.5; // 0.495 to remove artifacts caused by undersized matcap disks
		uv *= roughness;
		uv.x += uMatcapOffset.x;
		uv.y += uMatcapOffset.y;
		vec3 final = texture2D(uMatcapMap, uv).rgb;
		
		return final;
	}
#endif

mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
	vec3 q0 = dFdx( eye_pos.xyz );
	vec3 q1 = dFdy( eye_pos.xyz );
	vec2 st0 = dFdx( uv.st );
	vec2 st1 = dFdy( uv.st );

	vec3 N = surf_norm; // normalized

	vec3 q1perp = cross( q1, N );
	vec3 q0perp = cross( N, q0 );

	vec3 T = q1perp * st0.x + q0perp * st1.x;
	vec3 B = q1perp * st0.y + q0perp * st1.y;

	float det = max( dot( T, T ), dot( B, B ) );
	float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );

	return mat3( T * scale, B * scale, N );
}

vec2 rotateUV(vec2 uv, float rotation)
{
    float mid = 0.5;
    float cosAngle = cos(rotation);
    float sinAngle = sin(rotation);
    return vec2(
        cosAngle * (uv.x - mid) + sinAngle * (uv.y - mid) + mid,
        cosAngle * (uv.y - mid) - sinAngle * (uv.x - mid) + mid
    );
}

void main() {

	vec4 diffuseColor = vec4(uDiffuseColor, uOpacity);

	ReflectedLight reflectedLight = ReflectedLight(
		vec3(0.0), vec3(0.0), vec3(0.0), vec3(0.0)
	);
	vec3 totalEmissiveRadiance = uEmissiveColor;

	#ifdef USE_ALBEDO
		vec3 albedo = texture2D( uAlbedoMap, vUv * uAlbedoRepeat ).rgb;
		diffuseColor.rgb = mix(diffuseColor.rgb, albedo, uAlbedoIntensity);
	#endif

	vec3 normal = normalize(vNormal);

	#ifdef USE_NORMAL
		mat3 tbn = getTangentFrame(-vViewPosition, normal, vUv);
		vec3 normalMap = texture2D(uNormalMap, vUv * uNormalRepeat).xyz * 2.0 - 1.0;
		normalMap.xy *= uNormalScale;
		normal = normalize(tbn * normalMap);
	#endif

	float roughness = 1.;

	#ifdef USE_ROUGHNESS
		roughness = texture2D(uRoughnessMap, vUv * uRoughnessRepeat).r * uRoughnessIntensity;
	#endif

	// Lighting (and not Lightning⚡️)
	BlinnPhongMaterial material;
	material.diffuseColor = diffuseColor.rgb;
	material.specularColor = uSpecularColor;
	material.specularShininess = uShininess;
	material.specularStrength = uSpecularIntensity * roughness;

	#include <custom_lights_phong_fragment>

	vec3 finalColor = (reflectedLight.directDiffuse * uDiffuseIntensity ) + (reflectedLight.indirectDiffuse * uAmbientIntensity) + reflectedLight.directSpecular + reflectedLight.indirectSpecular + uEmissiveColor;

	// ao
	float ao = 1.;

	#ifdef USE_AO
		vec4 aoMap = texture2D(uAOMap, vUv * uAOMapRepeat);
		ao *= (aoMap.g - 1.0) * uAOMapIntensity + 1.0;
	#endif

	#ifdef USE_COMBINED_AO_MAP
		vec4 shadowAoMap = texture2D(uAOMap, vUv);
		ao *= (shadowAoMap.g - 1.0) * uAOMapShadowIntensity + 1.0; 
		ao *= (shadowAoMap.r - 1.0) * uAOMapOcclusionIntensity + 1.0;
	#endif

	#ifdef USE_VERTEX_AO
		ao *= (vColor.r - 1.) * uAOVertexIntensity + 1.0;
	
		#ifdef USE_SECONDARY_AO_VERTEX
			ao = mix((vColor.r - 1.) * uAOVertexIntensity + 1.0, (vColor.g - 1.) * uAOVertexIntensity + 1.0, uAOVertexMix);
		#endif
	#endif

	// ao - mix
	vec3 aoColor = vec3(1.0);
	aoColor = mix(aoColor, vec3(0.01, 0.0, 0.01), 1.0 - ao);

	finalColor = finalColor * aoColor;

	// matcap
	#ifdef USE_MATCAP
		float matcapRoughness = 1.;

		#ifdef USE_MATCAP_ROUGHNESS
			vec3 matcapNoise = texture2D(uMatcapNoiseMap, vUv * uMatcapNoiseRepeat).rgb;
			matcapRoughness += (matcapNoise.r * uMatcapNoiseChannel.r + matcapNoise.g * uMatcapNoiseChannel.g + matcapNoise.b * uMatcapNoiseChannel.b) * uMatcapNoiseIntensity;
		#endif

		vec3 matcapColor = matcap(matcapRoughness);
		finalColor *= clamp((matcapColor - 1.0) * uMatcapIntensity + 1.0, 0.0, 1.0);
	#endif

	gl_FragColor = clamp(vec4(finalColor, diffuseColor.a), 0., 1.);
	
	#include <tonemapping_fragment>
	#include <colorspace_fragment>

	#ifdef USE_FOG
    	#include <fog_fragment>
	#endif
}
