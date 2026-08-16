import { graphql } from "@octokit/graphql";

export interface ContributionDay {
  date: string;
  count: number;
}

export interface ContributionGrid {
  // weeks[weekIndex][dayIndex 0=Sun..6=Sat]
  weeks: ContributionDay[][];
  maxCount: number;
}

const QUERY = `
  query ($userName: String!) {
    user(login: $userName) {
      contributionsCollection {
        contributionCalendar {
          weeks {
            contributionDays {
              contributionCount
              date
              weekday
            }
          }
        }
      }
    }
  }
`;

interface GraphQLResponse {
  user: {
    contributionsCollection: {
      contributionCalendar: {
        weeks: {
          contributionDays: {
            contributionCount: number;
            date: string;
            weekday: number;
          }[];
        }[];
      };
    };
  };
}

export async function fetchContributionGrid(
  userName: string,
  token: string,
): Promise<ContributionGrid> {
  const gql = graphql.defaults({
    headers: { authorization: `token ${token}` },
  });

  const res = await gql<GraphQLResponse>(QUERY, { userName });

  const rawWeeks = res.user.contributionsCollection.contributionCalendar.weeks;

  let maxCount = 0;
  const weeks: ContributionDay[][] = rawWeeks.map((week) =>
    week.contributionDays.map((d) => {
      if (d.contributionCount > maxCount) maxCount = d.contributionCount;
      return { date: d.date, count: d.contributionCount };
    }),
  );

  return { weeks, maxCount };
}
