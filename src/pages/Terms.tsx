import { Helmet } from 'react-helmet-async';
import { LegalPageLayout } from '@/components/legal/LegalPageLayout';

const UPDATED = '2. oktober 2026';

export default function Terms() {
  return (
    <>
      <Helmet>
        <title>Terms of Service — GuildOS Bot</title>
        <meta
          name="description"
          content="Terms of Service for GuildOS Bot, the Discord server management and automation platform."
        />
        <link rel="canonical" href="https://bot.nethost-solutions.dk/terms" />
        <meta property="og:title" content="Terms of Service — GuildOS Bot" />
        <meta property="og:url" content="https://bot.nethost-solutions.dk/terms" />
      </Helmet>

      <LegalPageLayout
        title="Terms of Service"
        subtitle="Disse vilkår gælder for brug af GuildOS Bot, dashboardet, Discord-botten og de funktioner der stilles til rådighed gennem tjenesten."
        updatedAt={UPDATED}
      >
        <section>
          <h2>1. Accept af vilkårene</h2>
          <p>
            Ved at bruge GuildOS Bot accepterer du disse vilkår. Hvis du bruger tjenesten på
            vegne af en Discord-server, organisation eller virksomhed, bekræfter du, at du har
            ret til at administrere de relevante servere og indstillinger.
          </p>
        </section>

        <section>
          <h2>2. Tjenesten</h2>
          <p>
            GuildOS Bot leverer værktøjer til administration af Discord-servere, herunder
            moderation, tickets, automatisering, workflows, analytics, custom commands,
            integrationer og andre serverfunktioner. Funktioner kan ændres, tilføjes eller
            fjernes over tid.
          </p>
        </section>

        <section>
          <h2>3. Konto og adgang</h2>
          <ul>
            <li>Du skal opfylde Discord's gældende alderskrav og øvrige vilkår.</li>
            <li>Du er ansvarlig for aktiviteter udført via din konto og dine serverrettigheder.</li>
            <li>Du må ikke forsøge at få adgang til servere, data eller funktioner du ikke har tilladelse til.</li>
            <li>Discord-login og serveradgang afhænger af de rettigheder Discord rapporterer til GuildOS Bot.</li>
          </ul>
        </section>

        <section>
          <h2>4. Bot-tokens og custom bots</h2>
          <p>
            Hvis du forbinder din egen Discord-bot, er du ansvarlig for at oprette og administrere
            den gennem Discord Developer Portal. Bot-tokens er hemmelige credentials. Du må kun
            indsende tokens, som du selv har ret til at bruge, og du bør rotere tokenet straks,
            hvis du mistænker at det er kompromitteret.
          </p>
          <p>
            GuildOS Bot bruger de gemte credentials til at starte og administrere den custom bot
            og udføre de funktioner, som du aktiverer for den relevante server.
          </p>
        </section>

        <section>
          <h2>5. Acceptabel brug</h2>
          <p>Du må ikke bruge GuildOS Bot til at:</p>
          <ul>
            <li>overtræde gældende lovgivning, Discord's Terms of Service eller Community Guidelines,</li>
            <li>chikanere, true, doxxe eller målrette andre ulovligt,</li>
            <li>udsende spam, malware, phishing eller skadeligt indhold,</li>
            <li>omgå sikkerheds-, rate-limit-, adgangs- eller moderationsmekanismer,</li>
            <li>forsøge at kompromittere GuildOS Bot, andre brugere eller tredjepartssystemer,</li>
            <li>indsamle eller behandle personoplysninger uden et gyldigt grundlag.</li>
          </ul>
        </section>

        <section>
          <h2>6. Dit ansvar som serveradministrator</h2>
          <p>
            Serveradministratorer bestemmer i vidt omfang, hvilke GuildOS Bot-moduler der
            aktiveres, hvilke kanaler og roller der bruges, og hvilke moderation- eller
            automatiseringshandlinger der udføres. Du er ansvarlig for din servers regler,
            konfiguration og lovlige brug af de funktioner du aktiverer.
          </p>
        </section>

        <section>
          <h2>7. AI-funktioner og automatisering</h2>
          <p>
            Nogle funktioner kan anvende automatiske regler eller eksterne AI-tjenester.
            Automatiske vurderinger kan tage fejl. Du bør derfor gennemgå følsomme moderation-,
            support- eller administrationsbeslutninger, før de bruges som grundlag for væsentlige
            konsekvenser for en bruger.
          </p>
        </section>

        <section>
          <h2>8. Tredjepartstjenester</h2>
          <p>
            GuildOS Bot er afhængig af tredjepartstjenester såsom Discord, hosting- og
            databaseleverandører samt eventuelle integrationer, som du vælger at aktivere.
            Disse tjenester kan være underlagt deres egne vilkår og privatlivspolitikker.
          </p>
        </section>

        <section>
          <h2>9. Tilgængelighed og ændringer</h2>
          <p>
            Vi bestræber os på at holde tjenesten tilgængelig, men garanterer ikke uafbrudt eller
            fejlfri drift. Vedligeholdelse, Discord-ændringer, tredjepartsudfald eller tekniske
            problemer kan påvirke funktioner midlertidigt.
          </p>
        </section>

        <section>
          <h2>10. Suspension og ophør</h2>
          <p>
            Adgang kan begrænses eller lukkes ved væsentlig misbrug, sikkerhedsrisici, ulovlig
            anvendelse eller brud på disse vilkår. Du kan stoppe med at bruge tjenesten og fjerne
            botten fra din Discord-server når som helst.
          </p>
        </section>

        <section>
          <h2>11. Immaterielle rettigheder</h2>
          <p>
            GuildOS Bot, dashboardets design og den tilhørende software er beskyttet efter
            gældende regler om immaterielle rettigheder. Disse vilkår giver dig en begrænset ret
            til at bruge tjenesten, men overfører ikke ejerskab til software, design eller brand.
          </p>
        </section>

        <section>
          <h2>12. Ansvarsbegrænsning</h2>
          <p>
            Tjenesten leveres som et administrationsværktøj. I det omfang loven tillader det,
            er GuildOS Bot ikke ansvarlig for indirekte tab, tab af data, Discord-sanktioner eller
            konsekvenser af serverkonfigurationer, automatiske handlinger eller tredjepartstjenester.
            Intet i disse vilkår begrænser ansvar, som ikke lovligt kan begrænses.
          </p>
        </section>

        <section>
          <h2>13. Ændringer til vilkårene</h2>
          <p>
            Vilkårene kan opdateres, når tjenesten eller de juridiske krav ændrer sig.
            Den gældende version offentliggøres på denne side med datoen for seneste opdatering.
          </p>
        </section>

        <section>
          <h2>14. Kontakt</h2>
          <p>
            Spørgsmål om disse vilkår kan sendes til{' '}
            <a className="text-primary hover:underline" href="mailto:support@nethost-solutions.dk">
              support@nethost-solutions.dk
            </a>.
          </p>
        </section>
      </LegalPageLayout>
    </>
  );
}
