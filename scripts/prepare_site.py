from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / ".site_docs"


def clean_markdown(text: str) -> str:
    lines = text.splitlines()
    if lines and lines[0].lstrip().startswith("[←"):
        lines = lines[1:]
        while lines and not lines[0].strip():
            lines = lines[1:]
    return "\n".join(lines).rstrip() + "\n"


def copy_markdown_tree(source: Path, target: Path) -> None:
    for path in source.rglob("*"):
        rel = path.relative_to(source)
        dest = target / rel
        if path.is_dir():
            dest.mkdir(parents=True, exist_ok=True)
            continue
        if path.suffix.lower() == ".md":
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(clean_markdown(path.read_text(encoding="utf-8")), encoding="utf-8")


def main() -> None:
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)

    homepage = ROOT / "web" / "index.md"
    (OUT / "index.md").write_text(homepage.read_text(encoding="utf-8"), encoding="utf-8")

    copy_markdown_tree(ROOT / "knowledge", OUT / "knowledge")

    styles_target = OUT / "stylesheets"
    styles_target.mkdir(parents=True, exist_ok=True)
    shutil.copy2(ROOT / "web" / "stylesheets" / "extra.css", styles_target / "extra.css")

    scripts_target = OUT / "javascripts"
    scripts_target.mkdir(parents=True, exist_ok=True)
    for script in (ROOT / "web" / "javascripts").glob("*.js"):
        shutil.copy2(script, scripts_target / script.name)

    print(f"Prepared MkDocs source at {OUT}")


if __name__ == "__main__":
    main()
