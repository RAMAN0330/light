from dataclasses import dataclass


@dataclass(frozen=True)
class CapabilityAdapter:
    capability: str
    executable: str

    def command(self, arguments: list[str]) -> list[str]:
        return [self.executable, *arguments]
