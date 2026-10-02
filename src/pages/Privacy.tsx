import { Helmet } from 'react-helmet-async';
import { LegalPageLayout } from '@/components/legal/LegalPageLayout';

const UPDATED = '2. oktober 2026';

export default function Privacy() {
  return (
    <>
      <Helmet>
        <title>Privacy Policy — GuildOS Bot</title>
        <meta
          name="description"
          content="Privacy Policy for GuildOS Bot, including Discord OAuth, server data, moderation data and integrations."
        />
        <link rel="canonical" href="https://bot.nethost-solutions.dk/privacy" />
        <meta property="og:title" content="Privacy Policy — GuildOS Bot" />
        <meta property="og:url" content="https://bot.nethost-solutions.dk/privacy" />
      </Helmet>

      <LegalPageLayout
        title="Privacy Policy"
        subtitle="Denne privatlivspolitik beskriver hvilke oplysninger GuildOS Bot behandler, hvorfor de bruges, og hvilke valgmuligheder du har."
        updatedAt={UPDATED}
      >
        <section>
          <h2>1. Hvilke oplysninger vi behandler</h2>

          <h3>Discord-login og konto</h3>
          <p>
            Når du logger ind med Discord, anmoder GuildOS Bot om de Discord OAuth-oplysninger,
            der er nødvendige for login og servervalg. Det kan omfatte Discord-bruger-ID,
            brugernavn, avatar, e-mailadresse samt listen over servere og de rettigheder, som
            Discord oplyser for din konto.
          </p>

          <h3>Server- og konfigurationsdata</h3>
          <p>
            Vi kan behandle Discord server-ID, servernavn, ikon, kanal-ID'er, rolle-ID'er,
            command-indstillinger, modulkonfiguration, workflows, integrationsindstillinger og
            andre værdier du gemmer i dashboardet.
          </p>

          <h3>Moderation, tickets og aktivitet</h3>
          <p>
            Når relevante moduler er aktiveret, kan GuildOS Bot behandle bruger-ID'er,
            brugernavne, moderation-handlinger, advarsler, sagsnoter, ticket-indhold,
            transcripts, command-events, serveraktivitet og anden information, der er nødvendig
            for den valgte funktion.
          </p>

          <h3>Custom bot credentials</h3>
          <p>
            Hvis du aktiverer en custom Discord-bot, kan vi gemme bot client ID, public key,
            bot-navn, avatarindstillinger og bot-token. Bot-tokenet opbevares i en beskyttet
            kodet form og returneres ikke som almindelig plaintext til dashboardet efter lagring.
          </p>

          <h3>Tekniske data</h3>
          <p>
            GuildOS Bot kan behandle tekniske driftsdata såsom timestamps, bot-heartbeats,
            latency, fejlmeddelelser, audit logs og sikkerhedsrelateret metadata. Visse
            administrations- og sikkerhedsfunktioner kan også behandle netværksoplysninger,
            når det er nødvendigt for at beskytte tjenesten.
          </p>
        </section>

        <section>
          <h2>2. Hvorfor oplysningerne bruges</h2>
          <ul>
            <li>til at logge dig ind og identificere hvilke Discord-servere du må administrere,</li>
            <li>til at levere de moduler og automatiseringer du aktiverer,</li>
            <li>til moderation, tickets, logs, analytics og serveradministration,</li>
            <li>til at starte og administrere custom bots,</li>
            <li>til fejlfinding, sikkerhed, misbrugsforebyggelse og driftsstabilitet,</li>
            <li>til at forbedre og vedligeholde GuildOS Bot.</li>
          </ul>
        </section>

        <section>
          <h2>3. Retsgrundlag</h2>
          <p>
            Hvor GDPR finder anvendelse, behandles oplysninger efter omstændighederne for at
            levere den tjeneste du har anmodet om, på baggrund af legitime interesser i sikker
            og stabil drift, efter samtykke hvor det kræves, eller for at opfylde juridiske
            forpligtelser.
          </p>
          <p>
            Serveradministratorer kan selv være dataansvarlige for oplysninger, de vælger at
            behandle gennem botten, eksempelvis ticket-indhold eller moderation-data på deres
            Discord-server.
          </p>
        </section>

        <section>
          <h2>4. Discord og andre tjenesteudbydere</h2>
          <p>
            GuildOS Bot kommunikerer med Discord for login, serveroplysninger og botfunktioner.
            Data kan desuden behandles af leverandører, der understøtter hosting, database,
            autentifikation, netværk/CDN og andre nødvendige driftsfunktioner.
          </p>
          <p>
            Hvis du aktiverer AI- eller andre tredjepartsintegrationer, kan relevante dele af
            indholdet blive sendt til den valgte leverandør for at udføre den konkrete funktion.
            Den pågældende leverandørs egne vilkår og privatlivspolitik kan også gælde.
          </p>
        </section>

        <section>
          <h2>5. Hvor længe data gemmes</h2>
          <p>
            Data gemmes så længe det er nødvendigt for den funktion, de bruges til, for at
            levere tjenesten, opretholde sikkerhed eller opfylde gældende krav. Serverdata og
            konfiguration kan normalt fjernes ved at deaktivere funktioner, slette data i
            dashboardet eller kontakte support. Tekniske logs og backups kan eksistere i en
            begrænset periode efter sletning fra den aktive tjeneste.
          </p>
        </section>

        <section>
          <h2>6. Sikkerhed</h2>
          <p>
            Vi anvender adgangskontrol, server-side autorisation, databasepolitikker og andre
            tekniske og organisatoriske foranstaltninger for at begrænse uautoriseret adgang.
            Ingen internetbaseret tjeneste kan dog garantere absolut sikkerhed.
          </p>
          <p>
            Discord bot-tokens bør altid behandles som passwords. Hvis et token kan være blevet
            eksponeret, bør det straks nulstilles i Discord Developer Portal.
          </p>
        </section>

        <section>
          <h2>7. Dine rettigheder</h2>
          <p>
            Afhængigt af hvor du bor, kan du have ret til indsigt, rettelse, sletning,
            begrænsning, dataportabilitet eller indsigelse mod visse former for behandling.
            Du kan også have ret til at klage til den relevante databeskyttelsesmyndighed.
          </p>
          <p>
            For at anmode om adgang til eller sletning af oplysninger, kontakt os på adressen
            nedenfor. Vi kan være nødt til at bekræfte din identitet og servertilknytning.
          </p>
        </section>

        <section>
          <h2>8. Serveradministratorers ansvar</h2>
          <p>
            Serveradministratorer bestemmer hvilke moduler der aktiveres og kan dermed påvirke,
            hvilke oplysninger om servermedlemmer der behandles. Administratorer bør informere
            medlemmer om relevante bots, logs og automatiseringer og sikre et gyldigt grundlag
            for den behandling de konfigurerer.
          </p>
        </section>

        <section>
          <h2>9. Ændringer til politikken</h2>
          <p>
            Denne politik kan opdateres, når funktioner, leverandører eller juridiske krav
            ændrer sig. Den nyeste version offentliggøres her sammen med datoen for seneste
            opdatering.
          </p>
        </section>

        <section>
          <h2>10. Kontakt</h2>
          <p>
            Privatlivs- og dataforespørgsler kan sendes til{' '}
            <a className="text-primary hover:underline" href="mailto:support@nethost-solutions.dk">
              support@nethost-solutions.dk
            </a>.
          </p>
        </section>
      </LegalPageLayout>
    </>
  );
}
