import { NextResponse, NextRequest } from 'next/server';

// Allowlist of routes that are always accessible
const PUBLIC_PATHS: RegExp[] = [
	/^\/$/, // home page
	/^\/auth(\/.+)?$/, // auth routes if any
	/^\/oauth-callback$/, /^\/oauth-popup-callback$/, // OAuth callbacks
	/^\/api(\/.+)?$/, // API routes (adjust if needed)
	/^\/favicon\.ico$/, /^\/site\.webmanifest$/, /^\/favicon-.*\.(png|ico)$/,
	/^\/fonts\//, /^\/images\//, /^\/assets\//, /^\/_next\//,
];

function isPublicPath(pathname: string): boolean {
	return PUBLIC_PATHS.some(rx => rx.test(pathname));
}

export function middleware(req: NextRequest) {
	const { pathname } = req.nextUrl;

	// Always allow public paths
	if (isPublicPath(pathname)) {
		return NextResponse.next();
	}

	// Check lightweight auth cookie set on client when token exists
	const isAuth = req.cookies.get('isAuth')?.value === '1';

	// If not authenticated, redirect to home page
	if (!isAuth) {
		const url = req.nextUrl.clone();
		url.pathname = '/';
		url.searchParams.set('signin', '1');
		return NextResponse.redirect(url);
	}

	return NextResponse.next();
}

export const config = {
	matcher: ['/((?!_next|.*\\..*).*)'],
}; 