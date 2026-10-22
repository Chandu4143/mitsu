import subprocess, sys, os, signal, time

root = os.path.dirname(os.path.abspath(__file__))
os.chdir(root)

procs = []
try:
    be = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"],
        cwd=os.path.join(root, "backend"),
    )
    procs.append(be)
    fe = subprocess.Popen(["pnpm", "dev"], cwd=root)
    procs.append(fe)
    # wait for frontend (primary)
    fe.wait()
finally:
    for p in procs:
        try:
            p.terminate()
        except Exception:
            pass
    for p in procs:
        try:
            p.wait(timeout=5)
        except Exception:
            p.kill()
