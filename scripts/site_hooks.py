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
    def style_index(match):
        def card(entry):
            body = entry[1].strip()
            if body.startswith('<p>') and body.endswith('</p>'):
                body = body[3:-4].strip()
            link = re.fullmatch(r'<a href="([^"]+)"[^>]*>(.*?)</a>\s*(.*)', body, re.S)
            if not link or '<a ' in link[3] or '<li' in body:
                return entry[0]
            description = re.sub(r'^\s*[—–-]\s*', '', link[3]).strip()
            return (
                '<li class="atlas-topic-item"><a class="atlas-topic-card" href="'
                + link[1] + '"><span class="atlas-topic-title">' + link[2]
                + '</span>' + ('<span class="atlas-topic-description">' + description + '</span>' if description else '')
                + '<span class="atlas-topic-arrow" aria-hidden="true">↗</span></a></li>'
            )
        return re.sub(r'<li>(.*?)</li>', card, match[0], flags=re.S)

    content = re.sub(r'<div class="atlas-topic-index">.*?</div>', style_index, content, flags=re.S)

    def label_vocab(match):
        labels = ("No.", "Word / Phrase", "POS", "Meaning", "Mastery", "Weekly unfamiliar")
        def row(entry):
            cells = iter(labels)
            return re.sub(r"<td([^>]*)>", lambda m: '<td' + m[1] + ' data-label="' + next(cells) + '">', entry[0])
        return re.sub(r'<tr data-word=.*?</tr>', row, match[0], flags=re.S)

    content = re.sub(r'<table id="vocab-table".*?</table>', label_vocab, content, flags=re.S)

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
