import { Injectable, inject } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptorFn
} from '@angular/common/http';
import { Observable } from 'rxjs';

// OPTION 1: Utiliser une fonction (recommandé pour Angular 15+)
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  let token: string | null = null;

  try {
    token = localStorage.getItem('auth_token');
  } catch (err) {
    console.warn('LocalStorage access blocked in auth interceptor:', err);
  }

  if (token && !req.url.includes('/auth/')) {
    const cloned = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    return next(cloned);
  }
  
  return next(req);
};

// OPTION 2: Garder la classe (si vous préférez)
// @Injectable()
// export class AuthInterceptor implements HttpInterceptor {
//   private authService = inject(AuthService);
//
//   intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
//     const token = this.authService.getToken();
//
//     if (token && !request.url.includes('/auth/')) {
//       request = request.clone({
//         setHeaders: {
//           Authorization: `Bearer ${token}`
//         }
//       });
//     }
//
//     return next.handle(request);
//   }
// }
