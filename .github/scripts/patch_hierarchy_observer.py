from pathlib import Path

path = Path('app/user-hierarchy-panel.tsx')
text = path.read_text()
old = '''  useEffect(() => {\n    let observer: MutationObserver | null = null;\n    let loaded = false;\n\n    const detect = () => {\n      const node = document.querySelector<HTMLElement>(\".users-admin-grid\");\n      if (!node) return false;\n      node.dataset.vfHierarchyReplaced = \"true\";\n      setTarget(node);\n      observer?.disconnect();\n      if (!loaded) {\n        loaded = true;\n        void load();\n      }\n      return true;\n    };\n\n    if (!detect()) {\n      observer = new MutationObserver(detect);\n      observer.observe(document.body, { childList: true, subtree: true });\n    }\n    return () => observer?.disconnect();\n  }, [load]);\n'''
new = '''  useEffect(() => {\n    let currentTarget: HTMLElement | null = null;\n\n    const detect = () => {\n      const nextTarget = document.querySelector<HTMLElement>(\".users-admin-grid\");\n      if (nextTarget === currentTarget) return;\n\n      currentTarget = nextTarget;\n      setTarget(nextTarget);\n      if (!nextTarget) return;\n\n      nextTarget.dataset.vfHierarchyReplaced = \"true\";\n      void load();\n    };\n\n    detect();\n    const observer = new MutationObserver(detect);\n    observer.observe(document.body, { childList: true, subtree: true });\n    return () => observer.disconnect();\n  }, [load]);\n'''
if text.count(old) != 1:
    raise SystemExit(f'expected exactly one hierarchy observer block, found {text.count(old)}')
path.write_text(text.replace(old, new))
