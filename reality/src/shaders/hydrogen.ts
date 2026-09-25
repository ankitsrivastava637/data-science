// GLSL hydrogen eigenfunctions (atomic units), mirroring src/math/hydrogen.ts.
export const HYDROGEN = /* glsl */ `
float factf(int n){ float f = 1.0; for (int i = 2; i <= 12; i++) { if (i > n) break; f *= float(i); } return f; }
float laguerre(int k, float alpha, float x){
  if (k == 0) return 1.0;
  float l0 = 1.0, l1 = 1.0 + alpha - x;
  for (int i = 1; i < 8; i++) {
    if (i >= k) break;
    float fi = float(i);
    float l2 = ((2.0*fi + 1.0 + alpha - x)*l1 - (fi + alpha)*l0) / (fi + 1.0);
    l0 = l1; l1 = l2;
  }
  return l1;
}
float radialR(int n, int l, float r){
  float fn = float(n);
  float rho = 2.0*r/fn;
  float norm = sqrt(pow(2.0/fn, 3.0) * factf(n-l-1) / (2.0*fn*factf(n+l)));
  return norm * exp(-rho*0.5) * pow(rho, float(l)) * laguerre(n-l-1, float(2*l+1), rho);
}
float legendre(int l, int m, float x){
  float pmm = 1.0;
  if (m > 0) {
    float s = sqrt(max(0.0, (1.0-x)*(1.0+x)));
    float f = 1.0;
    for (int i = 1; i <= 6; i++) { if (i > m) break; pmm *= -f*s; f += 2.0; }
  }
  if (l == m) return pmm;
  float pmmp1 = x*float(2*m+1)*pmm;
  if (l == m+1) return pmmp1;
  float pll = 0.0;
  for (int ll = 2; ll <= 8; ll++) {
    int L = m + ll;
    if (L > l) break;
    pll = (float(2*L-1)*x*pmmp1 - float(L+m-1)*pmm) / float(L-m);
    pmm = pmmp1; pmmp1 = pll;
  }
  return pll;
}
float ylmK(int l, int m){
  return sqrt(float(2*l+1)/(4.0*3.14159265359) * factf(l-m) / factf(l+m));
}
// complex ψ_nlm at p (m >= 0; phase e^{imφ})
vec2 psiNLM(int n, int l, int m, vec3 p){
  float r = length(p);
  float ct = r > 1e-6 ? clamp(p.z / r, -1.0, 1.0) : 1.0;
  float a = radialR(n, l, r) * ylmK(l, m) * legendre(l, m, ct);
  float ph = float(m) * atan(p.y, p.x);
  return a * vec2(cos(ph), sin(ph));
}
vec2 cmul(vec2 a, vec2 b){ return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x); }
`;
