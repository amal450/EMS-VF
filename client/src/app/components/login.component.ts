import {
  Component, inject, OnDestroy, OnInit,
  ElementRef, ViewChild, AfterViewInit, NgZone,
  HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { LanguageService } from '../services/language.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements AfterViewInit, OnDestroy, OnInit {
  @ViewChild('globeCanvas') globeCanvasRef!: ElementRef<HTMLCanvasElement>;

  private authService = inject(AuthService);
  private router      = inject(Router);
  private zone        = inject(NgZone);
  public languageService = inject(LanguageService);

  // Suppression de registerName et isLogin car plus besoin d'inscription
  email        = '';
  password     = '';
  isLoading    = false;
  errorMessage = '';
  emailFocused = false;
  passFocused  = false;
  showPass     = false;

  currentSection = 0;
  isScrolling    = false;
  totalSections  = 5;

  private animId: number | null = null;
  private threeRenderer: any    = null;
  private scrollTimeout: any    = null;
  private touchStartY           = 0;

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      requestAnimationFrame(() => this.startGlobe());
    });
  }

  ngOnDestroy(): void {
    if (this.animId !== null) cancelAnimationFrame(this.animId);
    if (this.threeRenderer) { this.threeRenderer.dispose(); this.threeRenderer = null; }
    if (this.scrollTimeout) clearTimeout(this.scrollTimeout);
  }

  goTo(index: number): void {
    if (index < 0 || index >= this.totalSections) return;
    if (this.isScrolling) return;
    this.isScrolling = true;
    this.currentSection = index;
    this.scrollTimeout = setTimeout(() => { this.isScrolling = false; }, 900);
  }

  nextSection(): void {
    if (this.currentSection < this.totalSections - 1) this.goTo(this.currentSection + 1);
  }

  prevSection(): void {
    if (this.currentSection > 0) this.goTo(this.currentSection - 1);
  }

  toggleLanguage(): void {
    const next = this.languageService.language() === 'fr' ? 'en' : 'fr';
    this.languageService.setLanguage(next);
  }

  @HostListener('wheel', ['$event'])
  onWheel(e: WheelEvent): void {
    const target     = e.target as HTMLElement;
    const scrollable = target.closest('.sec-body-large, .login-card-new') as HTMLElement | null;

    if (scrollable) {
      const atTop    = scrollable.scrollTop <= 1;
      const atBottom = scrollable.scrollTop + scrollable.clientHeight >= scrollable.scrollHeight - 1;

      if (e.deltaY > 0 && !atBottom) return;
      if (e.deltaY < 0 && !atTop)    return;
    }

    e.preventDefault();
    if (this.isScrolling) return;
    if (e.deltaY > 0) this.nextSection();
    else              this.prevSection();
  }

  @HostListener('touchstart', ['$event'])
  onTouchStart(e: TouchEvent): void {
    this.touchStartY = e.touches[0].clientY;
  }

  @HostListener('touchend', ['$event'])
  onTouchEnd(e: TouchEvent): void {
    const diff       = this.touchStartY - e.changedTouches[0].clientY;
    const target     = e.target as HTMLElement;
    const scrollable = target.closest('.sec-body-large, .login-card-new') as HTMLElement | null;

    if (scrollable) {
      const atTop    = scrollable.scrollTop <= 1;
      const atBottom = scrollable.scrollTop + scrollable.clientHeight >= scrollable.scrollHeight - 1;
      if ((diff > 0 && !atBottom) || (diff < 0 && !atTop)) return;
    }

    if (Math.abs(diff) > 50) {
      if (diff > 0) this.nextSection();
      else          this.prevSection();
    }
  }

  @HostListener('keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); this.nextSection(); }
    if (e.key === 'ArrowUp'   || e.key === 'PageUp')   { e.preventDefault(); this.prevSection(); }
  }

  getTranslateY(): string {
    return `translateY(${-this.currentSection * 100}vh)`;
  }

  private startGlobe(): void {
    if ((window as any).THREE) { this.buildScene(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    s.onload = () => this.buildScene();
    document.head.appendChild(s);
  }

  private buildScene(): void {
    const THREE  = (window as any).THREE;
    const canvas = this.globeCanvasRef?.nativeElement;
    if (!THREE || !canvas) return;

    const W = () => window.innerWidth;
    const H = () => window.innerHeight;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W(), H());
    renderer.setClearColor(0x000000, 0);
    this.threeRenderer = renderer;

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, W() / H(), 0.1, 1000);
    camera.position.set(0.5, 0.1, 3.6);
    camera.lookAt(new THREE.Vector3(0.3, 0, 0));

    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(1, 64, 64),
      new THREE.MeshPhongMaterial({ color: 0x010c1e, emissive: new THREE.Color(0x021528), specular: new THREE.Color(0x00d9ff), shininess: 80 })
    );
    scene.add(globe);

    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(1.004, 36, 36),
      new THREE.MeshBasicMaterial({ color: 0x00d9ff, wireframe: true, transparent: true, opacity: 0.07 })
    ));

    [{ r: 1.08, c: 0x0ea5e9, o: 0.10 }, { r: 1.18, c: 0x2979ff, o: 0.05 }, { r: 1.32, c: 0x7b61ff, o: 0.02 }]
      .forEach(({ r, c, o }) => scene.add(new THREE.Mesh(
        new THREE.SphereGeometry(r, 64, 64),
        new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, side: THREE.BackSide })
      )));

    const NDOTS = 600; const dpos: number[] = []; const φ = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < NDOTS; i++) {
      const y = 1 - (i / (NDOTS - 1)) * 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const t = φ * i;
      dpos.push(r * Math.cos(t) * 1.003, y * 1.003, r * Math.sin(t) * 1.003);
    }
    const dGeo = new THREE.BufferGeometry();
    dGeo.setAttribute('position', new THREE.Float32BufferAttribute(dpos, 3));
    const dotCloud = new THREE.Points(dGeo, new THREE.PointsMaterial({ color: 0x00d9ff, size: 0.014, transparent: true, opacity: 0.75 }));
    scene.add(dotCloud);

    const geo2xyz = (lat: number, lon: number, r = 1.03) => {
      const phi   = (90 - lat) * (Math.PI / 180);
      const theta = (lon + 180) * (Math.PI / 180);
      return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
    };

    const nColors    = [0x00d9ff, 0xff9f43, 0x7b61ff, 0xff4fd8, 0x34d399];
    const nodeMeshes: any[] = [];
    [[48.8,2.3],[40.7,-74],[35.6,139.6],[51.5,-0.1],[-23.5,-46.6],[1.3,103.8],[55.7,37.6],[19.4,-99.1],[-33.8,151.2],[31.2,121.5],[25.2,55.3],[-34.6,-58.4],[22.3,114.1],[13.7,100.5],[28.6,77.2],[37.5,127.0],[6.5,3.4],[59.9,10.7],[41.0,28.9],[-26.2,28.0]]
      .forEach(([lat, lon], i) => {
        const n = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), new THREE.MeshBasicMaterial({ color: nColors[i % nColors.length] }));
        n.position.copy(geo2xyz(lat, lon));
        scene.add(n);
        nodeMeshes.push(n);
      });

    const aColors = [0x00d9ff, 0x2979ff, 0x7b61ff, 0xff4fd8, 0xff9f43];
    const arcMats: any[] = []; const curves: any[] = [];
    ([[[48.8,2.3],[40.7,-74]],[[35.6,139.6],[51.5,-0.1]],[[-23.5,-46.6],[48.8,2.3]],[[1.3,103.8],[55.7,37.6]],[[19.4,-99.1],[35.6,139.6]],[[-33.8,151.2],[51.5,-0.1]],[[31.2,121.5],[40.7,-74]],[[25.2,55.3],[48.8,2.3]],[[-34.6,-58.4],[35.6,139.6]],[[22.3,114.1],[28.6,77.2]],[[28.6,77.2],[25.2,55.3]],[[40.7,-74],[51.5,-0.1]]] as [number, number][][])
      .forEach(([from, to], i) => {
        const s   = geo2xyz(from[0], from[1]);
        const e   = geo2xyz(to[0], to[1]);
        const mid = s.clone().add(e).multiplyScalar(0.5).normalize().multiplyScalar(1.5 + (i % 3) * 0.1);
        const cv  = new THREE.QuadraticBezierCurve3(s, mid, e);
        curves.push(cv);
        const mat = new THREE.LineBasicMaterial({ color: aColors[i % aColors.length], transparent: true, opacity: 0.55 });
        scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(cv.getPoints(100)), mat));
        arcMats.push(mat);
      });

    const pulses = curves.map((cv: any, i: number) => {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 6), new THREE.MeshBasicMaterial({ color: aColors[i % aColors.length], transparent: true, opacity: 1 }));
      scene.add(p);
      return { mesh: p, cv, t: i / curves.length, spd: 0.0025 + Math.random() * 0.002 };
    });

    const sPos: number[] = [];
    for (let i = 0; i < 2000; i++) {
      const r = 7 + Math.random() * 8, phi = Math.random() * Math.PI * 2, th = Math.random() * Math.PI;
      sPos.push(r * Math.sin(th) * Math.cos(phi), r * Math.sin(th) * Math.sin(phi), r * Math.cos(th));
    }
    const sGeo = new THREE.BufferGeometry();
    sGeo.setAttribute('position', new THREE.Float32BufferAttribute(sPos, 3));
    const stars = new THREE.Points(sGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.018, transparent: true, opacity: 0.45 }));
    scene.add(stars);

    const pPos: number[] = [];
    for (let i = 0; i < 800; i++) pPos.push((Math.random() - .5) * 8, (Math.random() - .5) * 8, (Math.random() - .5) * 8);
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.Float32BufferAttribute(pPos, 3));
    const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0x00d9ff, size: 0.007, transparent: true, opacity: 0.30 }));
    scene.add(particles);

    scene.add(new THREE.AmbientLight(0x0a2040, 3.5));
    const kl = new THREE.DirectionalLight(0x00d9ff, 2.5); kl.position.set(4, 3, 5); scene.add(kl);
    const fl = new THREE.DirectionalLight(0x2979ff, 1.0); fl.position.set(-4, -2, -3); scene.add(fl);
    const rl = new THREE.PointLight(0x7b61ff, 1.5, 10); rl.position.set(-3, 2, -2); scene.add(rl);
    const ol = new THREE.PointLight(0xff9f43, 0.8, 8);  ol.position.set(3, -2, 2); scene.add(ol);

    window.addEventListener('resize', () => {
      camera.aspect = W() / H();
      camera.updateProjectionMatrix();
      renderer.setSize(W(), H());
    });

    let clock = 0;
    const tick = () => {
      this.animId = requestAnimationFrame(tick);
      clock += 0.007;
      globe.rotation.y     += 0.0018;
      dotCloud.rotation.y   = globe.rotation.y;
      stars.rotation.y     += 0.00006;
      particles.rotation.y += 0.00018;
      particles.rotation.x += 0.00006;
      camera.position.x = 0.5 + Math.sin(clock * 0.04) * 0.08;
      camera.position.y = 0.1 + Math.sin(clock * 0.03) * 0.06;
      camera.lookAt(0.3, 0, 0);
      pulses.forEach((pd: any) => {
        pd.t = (pd.t + pd.spd) % 1;
        pd.mesh.position.copy(pd.cv.getPoint(pd.t));
        pd.mesh.scale.setScalar(0.5 + 0.9 * Math.sin(pd.t * Math.PI * 2));
        (pd.mesh.material as any).opacity = 0.3 + 0.7 * Math.sin(pd.t * Math.PI * 2);
      });
      arcMats.forEach((m: any, i: number)  => { m.opacity = 0.20 + 0.50 * Math.abs(Math.sin(clock * 0.8 + i * 0.5)); });
      nodeMeshes.forEach((n: any, i: number) => { n.scale.setScalar(0.7 + 0.65 * Math.sin(clock * 2.0 + i * 0.7)); });
      rl.position.set(3 * Math.sin(clock * 0.20), 2, 3 * Math.cos(clock * 0.20));
      ol.position.set(3 * Math.cos(clock * 0.15), -2, 3 * Math.sin(clock * 0.15));
      renderer.render(scene, camera);
    };
    tick();
  }

  // Suppression de toggleMode car plus besoin d'inscription

  login() {
    this.isLoading = true;
    this.errorMessage = '';
    this.authService.login(this.email.trim().toLowerCase(), this.password.trim()).subscribe({
      next:  () => { this.isLoading = false; this.router.navigate(['/dashboard']); },
      error: (err: any) => { this.isLoading = false; this.errorMessage = err.error?.message || 'Identifiants invalides'; }
    });
  }
}