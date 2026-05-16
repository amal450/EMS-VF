import { Component, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { AssetStateService } from '../services/asset-state.service';
import { LanguageService } from '../services/language.service';

@Component({
  selector: 'app-hierarchy',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './hierarchy.component.html' 
})
export class HierarchyComponent implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  public authService = inject(AuthService);
  public assetState = inject(AssetStateService);
  public languageService = inject(LanguageService);

  hierarchy = signal<any[]>([]);
  isLoading = signal(true);
  errorMessage = signal('');
  showAssetModal = signal(false);
  isEditAssetMode = signal(false);
  showDeleteAssetModal = signal(false);
  assetToDeleteName = signal('');
  
  // États de pliage/dépliage
  collapsedSites = signal<Set<number>>(new Set());
  collapsedTgbts = signal<Set<number>>(new Set());
  collapsedArmoires = signal<Set<number>>(new Set());
  collapsedLignes = signal<Set<number>>(new Set());
  
  assetForm = signal({ 
    id: null as number | null, 
    name: '', 
    type: 'EQUIPEMENT', 
    parentId: null as number | null,
    webSocketLink: '',
    maxCurrent: 80
  });
  
  assetToDeleteId: number | null = null;

  ngOnInit() {
    this.loadHierarchy();
  }

  loadHierarchy() {
    const token = this.authService.getToken();
    if (!token) {
      this.errorMessage.set(this.languageService.translate('userNotLogged'));
      this.isLoading.set(false);
      return;
    }
    this.isLoading.set(true);
    this.errorMessage.set('');
    console.log('Token:', token);
    this.http.get<any[]>('http://localhost:3000/assets/tree', {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: res => {
        console.log('Hierarchy response:', res);
        this.hierarchy.set(res);
        this.isLoading.set(false);
      },
      error: err => {
        console.error('Erreur Asset:', err);
        this.errorMessage.set('Erreur: ' + (err.status + ' - ' + (err.error?.message || err.message || 'Erreur inconnue')));
        this.isLoading.set(false);
      }
    });
  }

  // Fonctions de pliage/dépliage
  toggleSite(siteId: number) {
    const currentSet = this.collapsedSites();
    if (currentSet.has(siteId)) {
      currentSet.delete(siteId);
    } else {
      currentSet.add(siteId);
    }
    this.collapsedSites.set(new Set(currentSet));
  }

  isSiteCollapsed(siteId: number): boolean {
    return this.collapsedSites().has(siteId);
  }

  toggleTgbt(tgbtId: number) {
    const currentSet = this.collapsedTgbts();
    if (currentSet.has(tgbtId)) {
      currentSet.delete(tgbtId);
    } else {
      currentSet.add(tgbtId);
    }
    this.collapsedTgbts.set(new Set(currentSet));
  }

  isTgbtCollapsed(tgbtId: number): boolean {
    return this.collapsedTgbts().has(tgbtId);
  }

  toggleArmoire(armoireId: number) {
    const currentSet = this.collapsedArmoires();
    if (currentSet.has(armoireId)) {
      currentSet.delete(armoireId);
    } else {
      currentSet.add(armoireId);
    }
    this.collapsedArmoires.set(new Set(currentSet));
  }

  isArmoireCollapsed(armoireId: number): boolean {
    return this.collapsedArmoires().has(armoireId);
  }

  toggleLigne(ligneId: number) {
    const currentSet = this.collapsedLignes();
    if (currentSet.has(ligneId)) {
      currentSet.delete(ligneId);
    } else {
      currentSet.add(ligneId);
    }
    this.collapsedLignes.set(new Set(currentSet));
  }

  isLigneCollapsed(ligneId: number): boolean {
    return this.collapsedLignes().has(ligneId);
  }

  selectAsset(asset: any) {
    this.assetState.setAsset(asset);
    this.router.navigate(['/dashboard'], { queryParams: { id: asset.id } });
  }

  // --- FONCTIONS POUR OUVRIR LES MODALS ---
  openAdd(parent: any, type: string) {
    this.isEditAssetMode.set(false);
    this.assetForm.set({ 
        id: null, name: '', type: type, 
        parentId: parent?.id || null, 
        webSocketLink: '', maxCurrent: 80 
    });
    this.showAssetModal.set(true);
  }

  openEdit(asset: any) {
    this.isEditAssetMode.set(true);
    this.assetForm.set({ 
      id: asset.id, name: asset.name, type: asset.type, 
      parentId: asset.parentId, 
      webSocketLink: asset.webSocketLink || '',
      maxCurrent: asset.maxCurrent || 80 
    });
    this.showAssetModal.set(true);
  }

  saveAsset() {
    const form = this.assetForm();
    const token = this.authService.getToken();
    const options = { headers: { Authorization: `Bearer ${token}` } };
    
    if (this.isEditAssetMode()) {
      this.http.patch(`http://localhost:3000/assets/${form.id}`, form, options).subscribe(() => {
        this.loadHierarchy();
        this.showAssetModal.set(false);
      });
    } else {
      this.http.post('http://localhost:3000/assets', form, options).subscribe(() => {
        this.loadHierarchy();
        this.showAssetModal.set(false);
      });
    }
  }

  askDelete(asset: any) {
    this.assetToDeleteId = asset.id;
    this.assetToDeleteName.set(asset.name);
    this.showDeleteAssetModal.set(true);
  }

  confirmDelete() {
    const token = this.authService.getToken();
    this.http.delete(`http://localhost:3000/assets/${this.assetToDeleteId}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe(() => {
      this.loadHierarchy();
      this.showDeleteAssetModal.set(false);
    });
  }

  getAddButtonLabel(type: string): string {
    const item = this.languageService.translateAssetType(type);
    const prefix = this.languageService.translate('add');
    return `${prefix} ${item}`;
  }
}