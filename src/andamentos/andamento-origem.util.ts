export function isAndamentoManual(origem: unknown): boolean {
  if (!origem || typeof origem !== 'object' || Array.isArray(origem)) {
    return false;
  }
  return (origem as { tipo?: unknown }).tipo === 'manual';
}
