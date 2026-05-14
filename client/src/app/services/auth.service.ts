import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, tap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3000/auth';

  private currentUserSubject = new BehaviorSubject<any>(JSON.parse(localStorage.getItem('user') || 'null'));
  public currentUser$ = this.currentUserSubject.asObservable();

  public get currentUserValue() { return this.currentUserSubject.value; }

  isAuthenticated(): boolean { return !!localStorage.getItem('auth_token'); }

  isAdmin(): boolean {
    const role = this.currentUserValue?.role?.toUpperCase();
    return role === 'ADMIN';
  }

  updateLocalUserData(newInfo: any) {
    const updatedUser = { ...this.currentUserValue, ...newInfo };
    this.currentUserSubject.next(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  }

  login(email: string, password: string) {
    return this.http.post<any>(`${this.apiUrl}/login`, { email, password }).pipe(
      tap(res => {
        if (res.access_token) {
          localStorage.setItem('auth_token', res.access_token);
          localStorage.setItem('user', JSON.stringify(res.user));
          this.currentUserSubject.next(res.user);
        }
      })
    );
  }

  register(email: string, username: string, password: string) {
    return this.http.post(`${this.apiUrl}/register`, { email, username, password });
  }

  getToken() { return localStorage.getItem('auth_token'); }

  hasPermission(code: string): boolean {
    if (this.isAdmin()) {
      return true;
    }
    const permissions = this.currentUserValue?.permissions ?? [];
    return permissions.includes(code);
  }

  logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
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
