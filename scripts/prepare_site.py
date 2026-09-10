from pathlib import Path
import html
import shutil

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / ".site_docs"


def clean_markdown(text: str) -> str:
    lines = text.splitlines()
    if lines and lines[0].lstrip().startswith("[←"):
        lines = lines[1:]
        while lines and not lines[0].strip():
            lines = lines[1:]
    text = "\n".join(lines).rstrip() + "\n"
    # Authoring instructions live in the repository, outside the reading site.
    text = text.replace(
        "(../AUTHORING_RULES.md)",
        "(https://github.com/YuxuanYangECNU/ielts-english-knowledge-base/blob/main/AUTHORING_RULES.md)",
    )
    return text


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


def read_vocab_rows():
    rows = []
    source = ROOT / "knowledge" / "vocabulary" / "vocab.tsv"
    for line in source.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        no, word, pos, meaning = line.split("\t", 3)
        rows.append((int(no), word, pos, meaning))
    return rows


def read_weekly_unfamiliar():
    source = ROOT / "knowledge" / "vocabulary" / "weekly_unfamiliar.tsv"
    mapping = {}
    lines = source.read_text(encoding="utf-8").splitlines()
    for line in lines[1:]:
        if not line.strip():
            continue
        week, ids = line.split("\t", 1)
        mapping[week] = {int(x) for x in ids.split(",") if x.strip()}
    return mapping


def render_vocab_tracker(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    # Newest learned words first; keep stable IDs for mastery and weekly flags.
    rows = sorted(read_vocab_rows(), key=lambda row: row[0], reverse=True)
    weekly = read_weekly_unfamiliar()
    id_to_weeks = {}
    for week, ids in weekly.items():
        for vocab_id in ids:
            id_to_weeks.setdefault(vocab_id, []).append(week)

    html_rows = []
    for no, word, pos, meaning in rows:
        weeks = id_to_weeks.get(no, [])
        weekly_value = ", ".join(weeks) if weeks else "—"
        initial = "Unfamiliar" if weeks else "Learning"
        options = []
        for value in ("Unfamiliar", "Learning", "Usable", "Mastered"):
            selected = " selected" if value == initial else ""
            options.append(f'<option value="{value}"{selected}>{value}</option>')
        html_rows.append(
            f'<tr data-word="{html.escape(word.lower())}" data-week="{html.escape(weekly_value)}" data-status="{initial}">'
            f'<td>{no}</td><td><strong>{html.escape(word)}</strong></td><td>{html.escape(pos)}</td>'
            f'<td>{html.escape(meaning)}</td><td><select class="mastery-select" data-vocab-id="{no}">{"".join(options)}</select></td>'
            f'<td class="weekly-flag">{html.escape(weekly_value)}</td></tr>'
        )

    week_options = "\n    ".join(
        f'<option value="{html.escape(week)}">{html.escape(week)} unfamiliar</option>'
        for week in weekly
    )
    total_weekly_records = sum(len(ids) for ids in weekly.values())
    text = text.replace("__VOCAB_TOTAL__", str(len(rows)))
    text = text.replace("__VOCAB_WEEKLY_TOTAL__", str(total_weekly_records))
    text = text.replace("__VOCAB_WEEK_OPTIONS__", week_options)
    text = text.replace("__VOCAB_ROWS__", "\n".join(html_rows))
    path.write_text(text, encoding="utf-8")


def copy_static_files(source_dir: Path, target_dir: Path, pattern: str) -> None:
    target_dir.mkdir(parents=True, exist_ok=True)
    for source in source_dir.glob(pattern):
        if source.is_file():
            shutil.copy2(source, target_dir / source.name)


def main() -> None:
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)

    homepage = ROOT / "web" / "index.md"
    (OUT / "index.md").write_text(homepage.read_text(encoding="utf-8"), encoding="utf-8")

    copy_markdown_tree(ROOT / "knowledge", OUT / "knowledge")
    render_vocab_tracker(OUT / "knowledge" / "vocabulary" / "README.md")

    # Copy every stylesheet referenced by mkdocs.yml. Previously only extra.css
    # was copied, which left Speaking pages unstyled in the deployed Pages artifact.
    copy_static_files(ROOT / "web" / "stylesheets", OUT / "stylesheets", "*.css")

    # Keep all website scripts in sync with the source tree.
    copy_static_files(ROOT / "web" / "javascripts", OUT / "javascripts", "*.js")

    print(f"Prepared MkDocs source at {OUT}")


if __name__ == "__main__":
    main()
