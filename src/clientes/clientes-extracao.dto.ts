import { ApiPropertyOptional } from '@nestjs/swagger';
import type { ClienteTipo } from './clientes.dto';

/**
 * Dados sugeridos por IA a partir de um documento (RG, CNH, contrato social etc.).
 * Todos os campos são opcionais/nuláveis: o que não for encontrado no documento
 * fica em branco para preenchimento manual — nunca é inventado pela IA.
 */
export class DadosClienteExtraidos {
  @ApiPropertyOptional({ nullable: true, type: String })
  nome?: string | null;

  @ApiPropertyOptional({ nullable: true, enum: ['PF', 'PJ'] })
  tipo?: ClienteTipo | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  cpf?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  cnpj?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  nomeFantasia?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  rg?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  email?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  telefone?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  endereco?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  cidade?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  uf?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  cep?: string | null;

  /** Avisos para o frontend exibir (ex.: `pdf_sem_texto`, `ia_resposta_invalida`). */
  @ApiPropertyOptional({ type: [String] })
  avisos?: string[];
}
