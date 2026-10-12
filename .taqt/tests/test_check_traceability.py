import importlib.util
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "ci"))


def load_module(name: str):
    path = ROOT / "scripts" / "ci" / f"{name}.py"
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


traceability = load_module("check_traceability")


def test_defined_ids_extracts_bdd_and_inv() -> None:
    text = "| BDD-TM-001 | ... |\n| INV-TM-002 | ... |\n参考: BDD-TM-001"
    assert traceability.defined_ids(text) == {"BDD-TM-001", "INV-TM-002"}


def test_dangling_reference_is_reported() -> None:
    violations = traceability.find_violations({"BDD-TM-001"}, {"BDD-TM-001", "BDD-TM-999"})
    assert violations == ["tests が未定義の ID を参照している: BDD-TM-999"]


def test_missing_test_is_reported() -> None:
    violations = traceability.find_violations({"BDD-TM-001", "BDD-TM-002"}, {"BDD-TM-001"})
    assert violations == ["定義された ID を参照するテストが無い: BDD-TM-002"]


def test_consistent_sets_have_no_violations() -> None:
    assert traceability.find_violations({"BDD-TM-001"}, {"BDD-TM-001"}) == []
