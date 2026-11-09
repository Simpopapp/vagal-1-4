# Planejamento: app de estudo de idiomas por letras de música

Letra **completa**, sem nenhuma concessão de experiência por preocupação com burocracia. E o centro do app passa a ser a **palavra**: a música é onde você a encontra, o **vocabulário** é onde ela é realmente estudada.

## A ideia

Você digita música e cantor do jeito que vier. O app entende qual é, traz a letra inteira e você lê com a música em mente, marcando as palavras que não conhece. Cada uma vai para uma área própria de vocabulário, onde é estudada com uma profundidade que dicionário e tradutor nunca dão: o significado literal, o que ela quer dizer em cada contexto, e quais confusões evitar. Tradutor de letra já existe. Aqui a letra é a fonte e o produto é a palavra entendida por inteiro.

Três partes em sequência: **achar a música → ler e marcar palavras → estudar no vocabulário**.

## Achar a música

A busca é interpretada, não mecânica. "bohemian rapsody quen" vira Queen / Bohemian Rhapsody sem o usuário acertar nada.

1. A IA deduz artista e música a partir do texto bruto, com grau de confiança e alternativas.
2. Vai ao Vagalume e encontra a letra sozinha, tentando variações do nome ou busca por trecho se a direta falhar.
3. Havendo mais de uma candidata (ao vivo, cover, artistas diferentes com a mesma música), escolhe a mais provável olhando os resultados reais.
4. Se a dúvida persistir, mostra 2 ou 3 cards ("era essa?") em vez de chutar.
5. Devolve a letra limpa e formatada (estrofes, refrões, sem lixo de site).

A IA **nunca escreve nem completa a letra**: só interpreta, procura e escolhe. O texto exibido é o que a fonte devolveu. Músicas já buscadas ficam salvas.

## Ler a letra: dois modos de toque

A tela principal é a letra inteira, em estrofes, confortável de ler. Tocar numa palavra faz uma de duas coisas, e o usuário alterna entre elas a qualquer momento, ali mesmo na tela:

- **Modo card:** o toque abre o card da palavra na hora, gerado no momento, com esqueleto visual e preenchimento progressivo. Bom para explorar e entender enquanto lê.
- **Modo coleta:** o toque só **marca** a palavra e segue. Nada abre, nenhum delay. O usuário percorre a música inteira selecionando tudo que não sabe, no ritmo da leitura. As palavras vão para o vocabulário e os cards são gerados **em segundo plano**, em fila, com indicador discreto de progresso (ex.: "7 de 12 prontas").

Um não substitui o outro. No modo coleta, tocar numa palavra já marcada abre o card dela, e no modo card dá para mandar a palavra ao vocabulário com um gesto. Ao terminar a música, o app pode mostrar um resumo: "você coletou 14 palavras, 9 já prontas".

## Identificar o que o usuário não sabe

Esse é o coração do recurso, porque define a qualidade do vocabulário:

- **Nível declarado** no começo, usado como régua de base.
- **Palavras comuns demais** para o nível (artigos, verbos básicos) não são sugeridas.
- **Pré-marcação na letra:** a IA destaca de forma sutil as palavras "provavelmente novas para você", e o usuário confirma ou ignora. Em vez de caçar palavra por palavra, ele revisa.
- **Memória do que já sabe:** palavra descartada, ou já dominada na prática, deixa de ser sugerida em músicas futuras.
- **A mesma palavra com outro sentido** em outra música é reconhecida e ligada à que já existe no vocabulário, em vez de duplicada.

## O card da palavra

Três tipos de tradução, cada um com cor e ícone próprios:

- **Literal:** o significado da palavra em si. Camada secundária.
- **Na frase:** o que ela significa *naquele contexto* e por que foi usada ali. É o destaque do card.
- **Por que ao invés de [sinônimo]:** a IA escolhe o sinônimo mais provável que o aprendiz tentaria usar e dá o veredito, sempre com uma linha de motivo:
  - ✗ **errado**
  - ✓ **certo**
  - ◐ **MCNC** (certo, mas menos cabível nesse contexto)

Abre como painel deslizante por baixo, sem cobrir a letra. Tudo que a IA devolve passa por formato estruturado e validado antes de aparecer.

## O vocabulário: a área principal

É a seção central do app, não um depósito. Cada palavra guarda o card completo, a frase da música e a música de origem, e ganha um **dossiê** que se aprofunda com o tempo, gerado sem pressa: usos mais comuns, combinações frequentes, registro (formal, informal, gíria), parecidas que confundem (inclusive falsos cognatos com o português) e o que evitar.

**Organização:** por música de origem, por categoria (classe gramatical, gíria/expressão, favoritas, difíceis, recém-coletadas), por frequência nas músicas que você ouve, e por estágio de aprendizado (nova, em estudo, dominada).

**Prática**, pensada para a palavra ser *entendida* e não só reconhecida, então cada revisão cobra um ângulo diferente dela:

- Revisão espaçada, com a frase da música como contexto, não a palavra solta.
- "Qual o significado nesse contexto?" (tipo *na frase*).
- "Esse sinônimo cabe aqui?" (tipo *por que ao invés de*), com os três vereditos como alternativas.
- Lacunas na letra da própria música de origem.
- Escolher entre palavras parecidas que o usuário costuma confundir.
- Reaparição: quando a palavra surge em outra música, o app avisa e mostra o novo uso ao lado do antigo, e isso conta como revisão.
- Palavras que o usuário mais erra voltam com mais frequência e por ângulos diferentes.

## Sem internet

Letras já abertas, vocabulário e cards já gerados funcionam offline. Palavras marcadas sem conexão ficam em fila e ganham card quando a internet voltar.

## Decisões em aberto

- Idioma de origem e destino inicial (inglês → português?) e se já nasce multi-idioma.
- Como o nível é definido: pergunta inicial, teste curto ou ajuste automático pelo uso.
- Quanto do dossiê é gerado automaticamente e quanto só quando o usuário abre a palavra, para controlar custo de IA.
- Se o veredito ✗/✓/◐ passa por uma checagem extra antes de ser salvo, já que ele vai ser revisado muitas vezes.

Se estiver bom, sigo para os próximos pilares nesse mesmo tom.
