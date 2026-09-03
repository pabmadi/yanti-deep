/**
 * Middleware de protección ligero (edge runtime): valida presencia de la cookie de sesión
 * y redirige a /ingresar si falta en rutas privadas. La validación real de la sesión y el
 * rol admin ocurre en las páginas y server actions (node runtime con acceso a la DB).
 */
import { NextResponse, type NextRequest } from "next/server";

const PRIVATE_PREFIXES = [
  "/inicio",
  "/mis-compras",
  "/mis-ventas",
  "/mis-reclamos",
  "/operaciones",
  "/disputas",
  "/crear-solicitud",
  "/perfil",
  "/admin",
  "/pagar",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPrivate = PRIVATE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (!isPrivate) return NextResponse.next();

  const token = request.cookies.get("yanti_session")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/ingresar", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|brand|ingresar|auth|dev).*)",
  ],
};
