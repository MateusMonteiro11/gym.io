# Contrato de integração do player V2

## Finalização e agendamentos

Após uma finalização bem-sucedida da sessão, o frontend deve continuar executando o fluxo atual `marcarAgendamentoConcluido(idUsuario, idTreino)`. Isso também se aplica quando a finalização ocorrer automaticamente ao concluir a última série.

As RPCs de persistência da sessão não escrevem em `agendamentos`; essa responsabilidade permanece na camada frontend.

## Data de execução do histórico

`historico_treinos.data_execucao` representa o instante de início da sessão (`treino_sessoes.iniciada_em`), isto é, quando o treino executado começou.
