# Relais HTTP entre l'instance Hermes d'essai et Ollama : transmet tout tel quel
# et consigne chaque requête et chaque réponse dans /journal (essai du ticket 10).
import os
import time

from aiohttp import ClientSession, ClientTimeout, web

CIBLE = os.environ.get("CIBLE", "http://ollama:11434")
JOURNAL = "/journal"
compteur = 0


async def relayer(req: web.Request) -> web.StreamResponse:
    global compteur
    compteur += 1
    i = compteur
    corps = await req.read()
    debut = time.time()
    with open(f"{JOURNAL}/{i:03d}-requete.txt", "wb") as f:
        f.write(f"{req.method} {req.path_qs}\n".encode())
        f.write(corps)
    entetes = {k: v for k, v in req.headers.items() if k.lower() in ("content-type", "accept")}
    async with ClientSession(timeout=ClientTimeout(total=None)) as session:
        async with session.request(req.method, CIBLE + req.path_qs, data=corps, headers=entetes) as r:
            rep = web.StreamResponse(status=r.status)
            if "Content-Type" in r.headers:
                rep.headers["Content-Type"] = r.headers["Content-Type"]
            await rep.prepare(req)
            with open(f"{JOURNAL}/{i:03d}-reponse.txt", "wb") as f:
                async for bloc in r.content.iter_any():
                    f.write(bloc)
                    await rep.write(bloc)
            await rep.write_eof()
            statut = r.status
    with open(f"{JOURNAL}/index.txt", "a") as f:
        f.write(f"{i:03d} {time.strftime('%H:%M:%S')} {req.method} {req.path_qs} {statut} "
                f"{time.time() - debut:.1f}s {len(corps)}o\n")
    return rep


app = web.Application(client_max_size=50 * 1024 * 1024)
app.router.add_route("*", "/{tail:.*}", relayer)
web.run_app(app, host="0.0.0.0", port=11434)
