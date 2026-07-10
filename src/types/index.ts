export interface Perfil {
  id: number;
  nome: string;
  descricao: string;
  nivel: number;
}

export interface Usuario {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  perfil: Perfil | null;
  unidade_id: number | null;
  setor_id: number | null;
  ativo: boolean;
  ultimo_acesso: string | null;
}
