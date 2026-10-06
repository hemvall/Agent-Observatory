export function GET(request:Request){return Response.redirect(new URL('/source.tar.gz',request.url),302);}
