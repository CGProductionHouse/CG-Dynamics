/** Nolan frosted-surface component. Does not claim volumetric refraction. */
export function easeOutQuint(value) {
  const p = Math.max(0, Math.min(1, Number(value)));
  return 1 - (1 - p) ** 5;
}
export function assertFinite(...values) {
  if (!values.every(Number.isFinite)) throw new TypeError('Finite values are required');
}
export function auditBackdropAncestors(element) {
  const issues = [];
  for (let ancestor = element.parentElement; ancestor && ancestor !== document.documentElement; ancestor = ancestor.parentElement) {
    const s = getComputedStyle(ancestor), flags = [];
    if (+s.opacity < 1) flags.push('ancestor opacity');
    if (s.filter !== 'none') flags.push('ancestor filter');
    if (s.clipPath !== 'none') flags.push('ancestor clip-path');
    if (s.maskImage && s.maskImage !== 'none') flags.push('ancestor mask');
    if (s.mixBlendMode !== 'normal') flags.push('ancestor blend mode');
    if (s.backdropFilter && s.backdropFilter !== 'none') flags.push('nested backdrop filter');
    if (/opacity|filter|mask|clip-path|mix-blend-mode/.test(s.willChange)) flags.push('ancestor will-change boundary');
    if (flags.length) issues.push({id: ancestor.id || ancestor.tagName, reasons: flags});
  }
  return issues;
}
export function surfacePlan(config) {
  if (!config || config.kind !== 'frosted_overlay') throw new Error('This component supports frosted_overlay only; use an actual 3D material for volumetric refraction');
  const {width, height, blur=24, radius=32, x=0, y=0} = config;
  assertFinite(width,height,blur,radius,x,y);
  if (width < 16 || height < 16 || width > 8192 || height > 8192) throw new RangeError('Invalid surface extent');
  if (blur < 0 || blur > 64 || radius < 0 || radius > Math.min(width,height)/2) throw new RangeError('Invalid blur/radius');
  if (!config.material_label || /photoreal|physically correct|volumetric/i.test(config.material_label)) throw new Error('Frosted-overlay label must not claim physical glass');
  return {width,height,blur,radius,x,y,kind:config.kind,material_label:config.material_label};
}
export class FrostedSurface {
  constructor(host, config) {
    this.config = surfacePlan(config);
    if (!CSS.supports('backdrop-filter','blur(1px)')) throw new Error('Backdrop-filter unsupported; do not silently substitute a solid panel');
    if (!(host instanceof HTMLElement)) throw new TypeError('Expected an existing DOM host');
    if (host.childElementCount) throw new Error('Use an empty dedicated host, not existing client artwork');
    this.host=host;host.classList.add('nolan-glass');
    Object.assign(host.style,{width:`${this.config.width}px`,height:`${this.config.height}px`,left:`${this.config.x}px`,top:`${this.config.y}px`});
    host.style.setProperty('--glass-radius',`${this.config.radius}px`);
    host.style.setProperty('--glass-blur',`${this.config.blur}px`);
    this.surface=document.createElement('div');this.surface.className='nolan-glass-surface';this.surface.setAttribute('aria-hidden','true');
    this.content=document.createElement('div');this.content.className='nolan-glass-content';
    host.append(this.surface,this.content);
  }
  setContent(nodes) { this.content.replaceChildren(...nodes); }
  setPose({x=0,y=0,rotate=0,scale=1,contentOpacity=1}={}) {
    assertFinite(x,y,rotate,scale,contentOpacity);
    if (scale<=0 || scale>4 || contentOpacity<0 || contentOpacity>1) throw new RangeError('Invalid pose');
    this.host.style.transform=`translate3d(${x}px,${y}px,0) rotate(${rotate}deg) scale(${scale})`;
    // Keep the material host opaque. Fading a parent creates a backdrop boundary.
    this.host.style.opacity='1';this.content.style.opacity=String(contentOpacity);
  }
  setControl(disabled) { this.surface.style.backdropFilter=disabled?'none':`blur(${this.config.blur}px) saturate(1.28)`; }
  audit() {
    return {kind:this.config.kind,backdrop:getComputedStyle(this.surface).backdropFilter,
      ancestor_issues:auditBackdropAncestors(this.surface),host_opacity:getComputedStyle(this.host).opacity};
  }
  dispose() { this.host.replaceChildren();this.host.classList.remove('nolan-glass'); }
}
