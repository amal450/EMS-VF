import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, tap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3000/auth';

  private inMemoryToken: string | null = null;
  private inMemoryUser: any = null;

  private currentUserSubject = new BehaviorSubject<any>(this.getStoredUser());
  public currentUser$ = this.currentUserSubject.asObservable();

  public get currentUserValue() { return this.currentUserSubject.value; }

  private getStoredUser() {
    const raw = this.getStorageItem('user');
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw);
    } catch (err) {
      console.warn('Failed to parse stored user:', err);
      return null;
    }
  }

  private getStorageItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch (err) {
      console.warn('LocalStorage access blocked or unavailable:', err);
      return null;
    }
  }

  private setStorageItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch (err) {
      console.warn('LocalStorage access blocked or unavailable:', err);
    }
  }

  private removeStorageItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (err) {
      console.warn('LocalStorage access blocked or unavailable:', err);
    }
  }

  isAuthenticated(): boolean { return !!this.getToken(); }

  login(email: string, password: string) {
    return this.http.post<any>(`${this.apiUrl}/login`, { email, password }).pipe(
      tap(res => {
        if (res.access_token) {
          this.inMemoryToken = res.access_token;
          this.inMemoryUser = res.user;
          this.setStorageItem('auth_token', res.access_token);
          this.setStorageItem('user', JSON.stringify(res.user));
          this.currentUserSubject.next(res.user);
        }
      })
    );
  }

  register(email: string, username: string, password: string) {
    return this.http.post(`${this.apiUrl}/register`, { email, username, password });
  }

  getToken() {
    return this.inMemoryToken || this.getStorageItem('auth_token');
  }

  isAdmin(): boolean {
    const role = this.currentUserValue?.role?.toUpperCase();
    return role === 'ADMIN';
  }

  hasPermission(code: string): boolean {
    if (this.isAdmin()) {
      return true;
    }
    const permissions = this.currentUserValue?.permissions ?? [];
    return permissions.includes(code);
  }

  updateLocalUserData(newInfo: any) {
    const updatedUser = { ...this.currentUserValue, ...newInfo };
    this.currentUserSubject.next(updatedUser);
    this.setStorageItem('user', JSON.stringify(updatedUser));
  }

  logout() {
    this.inMemoryToken = null;
    this.inMemoryUser = null;
    this.removeStorageItem('auth_token');
    this.removeStorageItem('user');
    this.currentUserSubject.next(null);
  }

  updateProfile(userId: number, data: { username: string; email: string }) {
    return this.http.patch<any>(`http://localhost:3000/users/${userId}`, data).pipe(
      tap(res => {
        const updatedUser = Array.isArray(res) ? res[0] : res;
        if (updatedUser) {
          this.updateLocalUserData(updatedUser);
        }
      })
    );
  }

  updatePassword(userId: number, password: string) {
    return this.http.patch<any>(`http://localhost:3000/users/${userId}/password`, { password });
  }
}
