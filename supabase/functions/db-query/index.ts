import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, table, data, where, select, limit, offset, orderBy } = await req.json();

    // Connect to external PostgreSQL (DigitalOcean requires sslmode=require)
    const sql = postgres({
      host: Deno.env.get('EXTERNAL_DB_HOST'),
      port: parseInt(Deno.env.get('EXTERNAL_DB_PORT') || '25061'),
      database: Deno.env.get('EXTERNAL_DB_DATABASE'),
      username: Deno.env.get('EXTERNAL_DB_USERNAME'),
      password: Deno.env.get('EXTERNAL_DB_PASSWORD'),
      ssl: 'require',
    });

    let result;

    switch (action) {
      case 'select': {
        const columns = select || '*';
        let query = `SELECT ${columns} FROM ${table}`;
        const params: any[] = [];
        
        if (where) {
          const conditions = Object.entries(where)
            .map(([key, value], index) => {
              params.push(value);
              return `${key} = $${index + 1}`;
            })
            .join(' AND ');
          query += ` WHERE ${conditions}`;
        }
        
        if (orderBy) {
          query += ` ORDER BY ${orderBy}`;
        }
        
        if (limit) {
          query += ` LIMIT ${limit}`;
        }
        
        if (offset) {
          query += ` OFFSET ${offset}`;
        }

        result = await sql.unsafe(query, params);
        break;
      }

      case 'insert': {
        const columns = Object.keys(data).join(', ');
        const values = Object.values(data) as (string | number | boolean | null)[];
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        const query = `INSERT INTO ${table} (${columns}) VALUES (${placeholders}) RETURNING *`;
        result = await sql.unsafe(query, values);
        break;
      }

      case 'update': {
        const updates = Object.entries(data)
          .map(([key, _], index) => `${key} = $${index + 1}`)
          .join(', ');
        const dataValues = Object.values(data) as (string | number | boolean | null)[];
        
        const whereConditions = Object.entries(where)
          .map(([key, _], index) => `${key} = $${dataValues.length + index + 1}`)
          .join(' AND ');
        const whereValues = Object.values(where) as (string | number | boolean | null)[];
        
        const query = `UPDATE ${table} SET ${updates} WHERE ${whereConditions} RETURNING *`;
        result = await sql.unsafe(query, [...dataValues, ...whereValues]);
        break;
      }

      case 'delete': {
        const conditions = Object.entries(where)
          .map(([key, _], index) => `${key} = $${index + 1}`)
          .join(' AND ');
        const values = Object.values(where) as (string | number | boolean | null)[];
        const query = `DELETE FROM ${table} WHERE ${conditions} RETURNING *`;
        result = await sql.unsafe(query, values);
        break;
      }

      case 'raw': {
        // For complex queries like authentication
        const { query, params } = data;
        result = await sql.unsafe(query, params || []);
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    await sql.end();

    return new Response(JSON.stringify({ data: result, error: null }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Database error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ data: null, error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
