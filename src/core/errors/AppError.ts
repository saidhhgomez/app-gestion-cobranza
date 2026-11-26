export class AppError extends Error {
  constructor(
    message: string,
    public readonly kind:
      'validation' | 'business' | 'persistence' | 'file' | 'unexpected' = 'business',
  ) {
    super(message);
    this.name = 'AppError';
  }
}
export function errorMessage(error: unknown): string {
  if (error instanceof AppError) return error.message;
  if (error instanceof Error && !/sqlite|constraint|SQL|database|table/i.test(error.message))
    return error.message;
  return 'No pudimos completar la operación. Revisa los datos e inténtalo nuevamente.';
}
export function persistenceError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const message = error instanceof Error ? error.message : '';
  if (message.includes('La lectura no es coherente'))
    return new AppError(
      'La lectura no es coherente con el historial del medidor. Revisa también las lecturas de periodos posteriores.',
      'persistence',
    );
  if (/locked|SQLITE_BUSY/i.test(message))
    return new AppError(
      'Hay otra operación guardándose. Espera un momento y vuelve a intentar.',
      'persistence',
    );
  if (/FOREIGN KEY/i.test(message))
    return new AppError(
      'Un registro relacionado no está disponible. Actualiza la pantalla y revisa tus datos.',
      'persistence',
    );
  if (/UNIQUE/i.test(message))
    return new AppError(
      'Ya existe un registro con estos datos. Revisa el listado para evitar duplicados.',
      'persistence',
    );
  return new AppError(
    'No se pudieron guardar los cambios. Los datos anteriores se conservaron. Revisa la información e inténtalo otra vez.',
    'persistence',
  );
}
