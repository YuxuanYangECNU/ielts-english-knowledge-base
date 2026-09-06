"""Reading-only presentation; source notes remain ordinary GitHub Markdown."""
import re


def on_page_markdown(markdown, page, **kwargs):
    if not page.file.src_uri.endswith("/README.md"):
        return markdown

    # Index entries are navigation, not content at the same level as their hub.
    markdown = re.sub(
        r"(## (?:Topic index|Index|Review queue)\s*\n)(.*?)(?=\n## |\Z)",
        lambda m: m[1] + '\n<div class="atlas-topic-index" markdown="1">\n\n'
        + m[2].strip() + '\n\n</div>\n',
        markdown,
        flags=re.S,
    )

    notes = []

    def move_pattern(match):
        # Keep the full methodology accessible, below the actual study content.
        notes.append(match[2].strip())
        return ""

    markdown = re.sub(
        r"## (Topic pattern|Note pattern|Practice pattern)\s*\n(.*?)(?=\n## |\Z)",
        move_pattern,
        markdown,
        flags=re.S,
    )
    if notes:
        markdown += (
            '\n\n<footer class="atlas-page-note" markdown="1">\n\n'
            '**Learn → Say it → Make it yours → Review**  \n'
            '★ Your personal expressions & priority language · ○ Recognition is enough\n\n'
            '<details class="atlas-note-details" markdown="1">\n'
            '<summary>About these notes · 学习说明</summary>\n\n'
            + "\n\n".join(notes)
            + '\n\n</details>\n\n</footer>\n'
        )
    return markdown


def on_page_content(content, **kwargs):
    def highlight_personal(match):
        star, body = match[1], match[2]
        # A hard line break separates the English sentence and its translation.
        parts = re.split(r"(<br\s*/?>)", body, maxsplit=1)
        english = parts[0].strip()
        if not english or english.startswith("<code>"):
            return match[0]
        translation = "".join(parts[1:])
        return (
            '<p class="atlas-personal-expression">'
            + star + '<mark class="atlas-highlight">' + english + '</mark>'
            + translation + '</p>'
        )

    return re.sub(
        r"<p>(\s*(?:★|<strong>★</strong>)\s+)(.*?)</p>",
        highlight_personal,
        content,
        flags=re.S,
    )
