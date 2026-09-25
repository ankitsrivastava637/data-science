// Shared GLSL: deterministic integer hashing, value/gradient noise, fbm, colour helpers.
export const COMMON = /* glsl */ `
uint uhash(uint x){ x ^= x >> 16; x *= 0x7feb352du; x ^= x >> 15; x *= 0x846ca68bu; x ^= x >> 16; return x; }
uint uhash3(uvec3 v){ return uhash(v.x ^ uhash(v.y ^ uhash(v.z))); }
float hash12(vec2 p){ return float(uhash3(uvec3(ivec3(ivec2(floor(p)), 17))) & 0xffffffu) / 16777216.0; }
float hash13(vec3 p){ return float(uhash3(uvec3(ivec3(floor(p)))) & 0xffffffu) / 16777216.0; }
float hash11(float n){ return float(uhash(uint(int(floor(n))) * 747796405u + 2891336453u) & 0xffffffu) / 16777216.0; }
vec2 hash22(vec2 p){ uint h = uhash3(uvec3(ivec3(ivec2(floor(p)), 91))); return vec2(float(h & 0xffffu), float(h >> 16)) / 65535.0; }
vec3 hash33(vec3 p){ uint h = uhash3(uvec3(ivec3(floor(p)))); return vec3(float(h & 0x3ffu), float((h>>10) & 0x3ffu), float((h>>20) & 0x3ffu)) / 1023.0; }

float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  float a = hash12(i), b = hash12(i+vec2(1,0)), c = hash12(i+vec2(0,1)), d = hash12(i+vec2(1,1));
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
float vnoise3(vec3 p){
  vec3 i = floor(p), f = fract(p); vec3 u = f*f*(3.0-2.0*f);
  float n000 = hash13(i), n100 = hash13(i+vec3(1,0,0)), n010 = hash13(i+vec3(0,1,0)), n110 = hash13(i+vec3(1,1,0));
  float n001 = hash13(i+vec3(0,0,1)), n101 = hash13(i+vec3(1,0,1)), n011 = hash13(i+vec3(0,1,1)), n111 = hash13(i+vec3(1,1,1));
  return mix(mix(mix(n000,n100,u.x), mix(n010,n110,u.x), u.y), mix(mix(n001,n101,u.x), mix(n011,n111,u.x), u.y), u.z);
}
float fbm(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<5;i++){ s += a*vnoise(p); p = p*2.03 + vec2(17.1, 3.7); a *= 0.5; } return s; }
float fbm3(vec3 p){ float s=0.0, a=0.5; for(int i=0;i<4;i++){ s += a*vnoise3(p); p = p*2.02 + vec3(11.3, 5.1, 7.7); a *= 0.5; } return s; }
float ridge(float x){ return 1.0 - abs(2.0*x - 1.0); }

vec3 srgbToLinear(vec3 c){ return mix(c/12.92, pow((c+0.055)/1.055, vec3(2.4)), step(0.04045, c)); }
float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
// restrained phase palette: warm ↔ cool around the circle, low saturation
vec3 phaseColor(float ph){
  vec3 warm = vec3(1.0, 0.62, 0.34), cool = vec3(0.36, 0.62, 1.0), pale = vec3(0.9, 0.88, 0.8), deep = vec3(0.62, 0.42, 0.9);
  float a = ph * 6.28318530718;
  float c = cos(a), s = sin(a);
  return max(vec3(0.0), 0.5*(1.0+c)*warm + 0.5*(1.0-c)*cool + 0.25*s*(pale-deep));
}
`;

/** CIE 1931 colour matching (analytic multi-lobe Gaussian fit, Wyman, Sloan & Shirley 2013) → linear sRGB. */
export const SPECTRAL = /* glsl */ `
vec3 cieXYZ(float l){
  float t1 = (l-442.0)*((l<442.0)?0.0624:0.0374);
  float t2 = (l-599.8)*((l<599.8)?0.0264:0.0323);
  float t3 = (l-501.1)*((l<501.1)?0.0490:0.0382);
  float x = 0.362*exp(-0.5*t1*t1) + 1.056*exp(-0.5*t2*t2) - 0.065*exp(-0.5*t3*t3);
  float t4 = (l-568.8)*((l<568.8)?0.0213:0.0247);
  float t5 = (l-530.9)*((l<530.9)?0.0613:0.0322);
  float y = 0.821*exp(-0.5*t4*t4) + 0.286*exp(-0.5*t5*t5);
  float t6 = (l-437.0)*((l<437.0)?0.0845:0.0278);
  float t7 = (l-459.0)*((l<459.0)?0.0385:0.0725);
  float z = 1.217*exp(-0.5*t6*t6) + 0.681*exp(-0.5*t7*t7);
  return vec3(x,y,z);
}
vec3 xyzToLinearSRGB(vec3 c){
  return mat3(3.2404542,-0.9692660,0.0556434, -1.5371385,1.8760108,-0.2040259, -0.4985314,0.0415560,1.0572252) * c;
}
// spectral colour of a monochromatic wavelength, gamut-mapped by desaturating toward white
vec3 wavelengthColor(float l){
  vec3 rgb = xyzToLinearSRGB(cieXYZ(l));
  float m = min(min(rgb.r, rgb.g), rgb.b);
  if (m < 0.0) rgb -= m;
  return rgb;
}
`;
