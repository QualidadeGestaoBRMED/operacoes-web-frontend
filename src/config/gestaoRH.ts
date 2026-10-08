// Gestão de férias fora desta fase do módulo Gestão RH: só o absenteísmo
// aparece. Com false, menu, rota /modulos/gestao-rh/ferias, aba Férias do
// modal e régua de férias dos Parâmetros ficam escondidos; o código de
// férias continua no repositório. A varredura diária de férias do backend
// também está desligada (agenda desativada no Django). Religar é trocar
// para true aqui e reativar a agenda.
export const FERIAS_ATIVA: boolean = false;
