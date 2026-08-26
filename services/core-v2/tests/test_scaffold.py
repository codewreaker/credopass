"""Placeholder suite so `uv run pytest` has something to run in week 0.

Delete this file in week 1, when the first real tests (the health routes) land.
It exists only so the week-0 done-when check — `uv run pytest` exits 0 — means
"the toolchain works" rather than "pytest found nothing", which exits 5.
"""


def test_app_package_imports() -> None:
    import app

    assert app.__doc__ is not None
